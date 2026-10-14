import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { checkPoll, type PollInput } from "./lib/pollRules";
import { requireTeacher } from "./lib/requireTeacher";
import { ensureRoom, readRoom } from "./lib/room";
import { deleteRun, tallyRun } from "./lib/runs";
import { inlinePollsBySlide, startInlineRun } from "./lib/inlineRuns";
import { clampSlide, splitSlides } from "./lib/slides";
import { pollsInContent } from "./lib/inlinePolls";

const pollFields = {
  question: v.string(),
  options: v.array(v.string()),
  correctIndex: v.optional(v.number()), // unset = opinion poll
};

function validPoll(input: PollInput): PollInput {
  const checked = checkPoll(input);
  if ("error" in checked) throw new ConvexError(checked.error);
  return checked.poll;
}

// ---------------------------------------------------------------------------
// Public (anonymous)
// ---------------------------------------------------------------------------

export const submitVote = mutation({
  args: {
    runId: v.id("pollRuns"),
    voterToken: v.string(),
    selectedOption: v.number(),
  },
  handler: async (ctx, { runId, voterToken, selectedOption }) => {
    const token = voterToken.trim();
    if (token.length < 8 || token.length > 64) throw new ConvexError("Invalid voter token");

    const run = await ctx.db.get(runId);
    if (!run || !run.open) throw new ConvexError("This poll is not open");
    if (run.revealed) throw new ConvexError("Voting is closed: results have been revealed");
    if ((await readRoom(ctx))?.paused) throw new ConvexError("Voting is paused");
    if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= run.options.length) {
      throw new ConvexError("Invalid option");
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_run_voter", (q) => q.eq("runId", runId).eq("voterToken", token))
      .first();
    if (existing) throw new ConvexError("You have already voted");

    await ctx.db.insert("votes", { runId, voterToken: token, selectedOption });
  },
});

export const hasVoted = query({
  args: { runId: v.id("pollRuns"), voterToken: v.string() },
  handler: async (ctx, { runId, voterToken }) => {
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_run_voter", (q) => q.eq("runId", runId).eq("voterToken", voterToken.trim()))
      .first();
    return existing !== null;
  },
});

// ---------------------------------------------------------------------------
// Teacher only: saved polls
// ---------------------------------------------------------------------------

async function appendToLesson(ctx: MutationCtx, lessonId: Id<"lessons">, pollId: Id<"polls">) {
  const last = await ctx.db
    .query("lessonPolls")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
    .order("desc")
    .first();
  await ctx.db.insert("lessonPolls", { lessonId, pollId, order: (last?.order ?? -1) + 1 });
}

async function insertPoll(ctx: MutationCtx, input: PollInput, lessonId: Id<"lessons"> | undefined) {
  const poll = validPoll(input);
  if (lessonId && !(await ctx.db.get(lessonId))) throw new ConvexError("Lesson not found");
  const now = Date.now();
  const pollId = await ctx.db.insert("polls", { ...poll, ownerLessonId: lessonId, createdAt: now, updatedAt: now });
  if (lessonId) await appendToLesson(ctx, lessonId, pollId);
  return pollId;
}

/** With `lessonId`: a lesson poll (deleted with the lesson). Without: a bank poll. */
export const createPoll = mutation({
  args: { ...pollFields, lessonId: v.optional(v.id("lessons")) },
  handler: async (ctx, { lessonId, ...input }) => {
    await requireTeacher(ctx);
    return await insertPoll(ctx, input, lessonId);
  },
});

/** Edits a saved poll everywhere it's used. Refused while it's being shown. */
export const updatePoll = mutation({
  args: { pollId: v.id("polls"), ...pollFields },
  handler: async (ctx, { pollId, ...input }) => {
    await requireTeacher(ctx);
    const existing = await ctx.db.get(pollId);
    if (!existing) throw new ConvexError("Poll not found");
    const live = await ctx.db
      .query("pollRuns")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .first();
    if (live) throw new ConvexError("Close this poll before editing it");
    // replace, not patch: turning a quiz into an opinion poll must drop correctIndex.
    await ctx.db.replace(pollId, {
      ...validPoll(input),
      ownerLessonId: existing.ownerLessonId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    });
  },
});

/** Deletes a saved poll and its links to lessons. A run already on screen keeps its copy. */
export const deletePoll = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, { pollId }) => {
    await requireTeacher(ctx);
    const links = await ctx.db
      .query("lessonPolls")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .collect();
    for (const link of links) await ctx.db.delete(link._id);
    if (await ctx.db.get(pollId)) await ctx.db.delete(pollId);
  },
});

/**
 * A lesson's Polls tab: its saved polls in order (own ones and linked bank polls), and the
 * inline ```poll blocks in its Markdown (read-only here; edited in the lesson).
 */
export const listLessonPolls = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await requireTeacher(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const links = await ctx.db
      .query("lessonPolls")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .collect();
    const saved = [];
    for (const link of links) {
      const poll = await ctx.db.get(link.pollId);
      if (poll) saved.push({ linkId: link._id, ...poll, inBank: poll.ownerLessonId === undefined });
    }
    return { saved, inline: pollsInContent(lesson.content) };
  },
});

/** Bank polls (no owning lesson), newest first; `search` matches words in the question. */
export const searchBank = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireTeacher(ctx);
    const text = search?.trim() ?? "";
    const found = text
      ? await ctx.db
          .query("polls")
          .withSearchIndex("search_question", (q) => q.search("question", text))
          .take(100)
      : await ctx.db.query("polls").order("desc").take(200);
    const bank = found.filter((p) => p.ownerLessonId === undefined).slice(0, 50);
    return await Promise.all(
      bank.map(async (poll) => ({
        ...poll,
        lessonCount: (
          await ctx.db
            .query("lessonPolls")
            .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
            .collect()
        ).length,
      })),
    );
  },
});

/** Adds a bank poll to a lesson's list (shared, not copied: edits show up everywhere). */
export const linkPoll = mutation({
  args: { lessonId: v.id("lessons"), pollId: v.id("polls") },
  handler: async (ctx, { lessonId, pollId }) => {
    await requireTeacher(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) throw new ConvexError("Poll not found");
    if (poll.ownerLessonId !== undefined) throw new ConvexError("Only bank polls can be added to other lessons");
    if (!(await ctx.db.get(lessonId))) throw new ConvexError("Lesson not found");
    const links = await ctx.db
      .query("lessonPolls")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .collect();
    if (links.some((l) => l.lessonId === lessonId)) throw new ConvexError("This lesson already has that poll");
    await appendToLesson(ctx, lessonId, pollId);
  },
});

/** Removes a bank poll from a lesson; the poll stays in the bank. */
export const unlinkPoll = mutation({
  args: { linkId: v.id("lessonPolls") },
  handler: async (ctx, { linkId }) => {
    await requireTeacher(ctx);
    const link = await ctx.db.get(linkId);
    if (!link) return;
    const poll = await ctx.db.get(link.pollId);
    if (poll && poll.ownerLessonId !== undefined) {
      throw new ConvexError("This poll belongs to the lesson; delete it instead");
    }
    await ctx.db.delete(linkId);
  },
});

/** Moves a poll one place up or down in its lesson's list. */
export const movePoll = mutation({
  args: { linkId: v.id("lessonPolls"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { linkId, direction }) => {
    await requireTeacher(ctx);
    const link = await ctx.db.get(linkId);
    if (!link) throw new ConvexError("Poll not found");
    const neighbour = await ctx.db
      .query("lessonPolls")
      .withIndex("by_lesson", (q) =>
        direction === "up"
          ? q.eq("lessonId", link.lessonId).lt("order", link.order)
          : q.eq("lessonId", link.lessonId).gt("order", link.order),
      )
      .order(direction === "up" ? "desc" : "asc")
      .first();
    if (!neighbour) return;
    await ctx.db.patch(link._id, { order: neighbour.order });
    await ctx.db.patch(neighbour._id, { order: link.order });
  },
});

// ---------------------------------------------------------------------------
// Teacher only: running saved polls (they take over the students' screen)
// ---------------------------------------------------------------------------

async function startSavedRun(ctx: MutationCtx, pollId: Id<"polls">) {
  const poll = await ctx.db.get(pollId);
  if (!poll) throw new ConvexError("Poll not found");
  const room = await ensureRoom(ctx);
  if (room.activeRunId) await deleteRun(ctx, room.activeRunId);
  const runId = await ctx.db.insert("pollRuns", {
    kind: "saved",
    pollId,
    question: poll.question,
    options: poll.options,
    correctIndex: poll.correctIndex,
    open: true,
    revealed: false,
  });
  await ctx.db.patch(room._id, { mode: "poll", activeRunId: runId, link: undefined, paused: undefined, updatedAt: Date.now() });
  return runId;
}

export const launchSaved = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, { pollId }) => {
    await requireTeacher(ctx);
    return await startSavedRun(ctx, pollId);
  },
});

/** Write a poll and show it now. It's saved (to the bank, or the lesson) for reuse. */
export const launchNew = mutation({
  args: { ...pollFields, lessonId: v.optional(v.id("lessons")) },
  handler: async (ctx, { lessonId, ...input }) => {
    await requireTeacher(ctx);
    return await startSavedRun(ctx, await insertPoll(ctx, input, lessonId));
  },
});

/** Shows the results (and the answer, for a quiz) and closes voting. Inline runs too. */
export const revealRun = mutation({
  args: { runId: v.id("pollRuns") },
  handler: async (ctx, { runId }) => {
    await requireTeacher(ctx);
    if (!(await ctx.db.get(runId))) throw new ConvexError("This poll is no longer running");
    await ctx.db.patch(runId, { open: false, revealed: true });
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { updatedAt: Date.now() });
  },
});

/** Run again: clears an inline poll on the current slide and opens voting. */
export const rerunInline = mutation({
  args: { blockIndex: v.number() },
  handler: async (ctx, { blockIndex }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    const slide = clampSlide(room.currentSlide ?? 0, splitSlides(room.currentContent).length);
    const poll = inlinePollsBySlide(room.currentContent)[slide]?.[blockIndex];
    if (!poll) throw new ConvexError("That poll isn't on the current slide");
    const old = await ctx.db
      .query("pollRuns")
      .withIndex("by_slide", (q) => q.eq("kind", "inline").eq("slide", slide).eq("blockIndex", blockIndex))
      .collect();
    for (const run of old) await deleteRun(ctx, run._id);
    // A new run (new id) so students' screens reset their "voted" state too.
    await startInlineRun(ctx, slide, blockIndex, poll);
    await ctx.db.patch(room._id, { updatedAt: Date.now() });
  },
});

/** Ends the hand-launched poll: its votes are deleted and students go back to the lesson. */
export const closeSaved = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    if (room.activeRunId) await deleteRun(ctx, room.activeRunId);
    await ctx.db.patch(room._id, { mode: "lesson", activeRunId: undefined, updatedAt: Date.now() });
  },
});

/** Teacher's live tally, including the correct answer (the teacher may see it). */
export const getRunTally = query({
  args: { runId: v.id("pollRuns") },
  handler: async (ctx, { runId }) => {
    await requireTeacher(ctx);
    const run = await ctx.db.get(runId);
    if (!run) return null;
    return {
      runId,
      question: run.question,
      options: run.options,
      correctIndex: run.correctIndex ?? null,
      open: run.open,
      revealed: run.revealed,
      ...(await tallyRun(ctx, run)),
    };
  },
});
