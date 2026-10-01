import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeacher } from "./lib/requireTeacher";
import { deactivatePoll, ensureRoom, readRoom } from "./lib/room";

// ---------------------------------------------------------------------------
// Public (anonymous)
// ---------------------------------------------------------------------------

export const submitVote = mutation({
  args: {
    pollId: v.id("polls"),
    voterToken: v.string(),
    selectedOption: v.number(),
  },
  handler: async (ctx, { pollId, voterToken, selectedOption }) => {
    const token = voterToken.trim();
    if (token.length < 8 || token.length > 64) throw new ConvexError("Invalid voter token");

    const room = await readRoom(ctx);
    if (!room || room.mode !== "poll" || room.activePollId !== pollId) {
      throw new ConvexError("This poll is not active");
    }
    const poll = await ctx.db.get(pollId);
    if (!poll || !poll.isActive) throw new ConvexError("This poll is not active");
    if (poll.showResults) throw new ConvexError("Voting is closed: results have been revealed");
    if (
      !Number.isInteger(selectedOption) ||
      selectedOption < 0 ||
      selectedOption >= poll.options.length
    ) {
      throw new ConvexError("Invalid option");
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_poll_voter", (q) => q.eq("pollId", pollId).eq("voterToken", token))
      .first();
    if (existing) throw new ConvexError("You have already voted");

    await ctx.db.insert("votes", { pollId, voterToken: token, selectedOption });
  },
});

export const hasVoted = query({
  args: { pollId: v.id("polls"), voterToken: v.string() },
  handler: async (ctx, { pollId, voterToken }) => {
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_poll_voter", (q) =>
        q.eq("pollId", pollId).eq("voterToken", voterToken.trim()),
      )
      .first();
    return existing !== null;
  },
});

// ---------------------------------------------------------------------------
// Teacher only
// ---------------------------------------------------------------------------

export const launchPoll = mutation({
  args: {
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
  },
  handler: async (ctx, args) => {
    await requireTeacher(ctx);
    const question = args.question.trim();
    const options = args.options.map((o) => o.trim());
    if (!question || question.length > 500) throw new ConvexError("Question must be 1–500 characters");
    if (options.length < 2 || options.length > 4) throw new ConvexError("A poll needs 2–4 options");
    if (options.some((o) => !o || o.length > 200)) {
      throw new ConvexError("Every option must be 1–200 characters");
    }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      throw new ConvexError("Options must be distinct");
    }
    if (
      !Number.isInteger(args.correctIndex) ||
      args.correctIndex < 0 ||
      args.correctIndex >= options.length
    ) {
      throw new ConvexError("Correct answer must be one of the options");
    }

    const room = await ensureRoom(ctx);
    if (room.activePollId) await deactivatePoll(ctx, room.activePollId);
    const pollId = await ctx.db.insert("polls", {
      question,
      options,
      correctIndex: args.correctIndex,
      showResults: false,
      isActive: true,
      createdAt: Date.now(),
    });
    await ctx.db.patch(room._id, { mode: "poll", activePollId: pollId, updatedAt: Date.now() });
    return pollId;
  },
});

export const revealPollResults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    if (!room.activePollId) throw new ConvexError("No active poll");
    const poll = await ctx.db.get(room.activePollId);
    if (!poll || !poll.isActive) throw new ConvexError("No active poll");
    await ctx.db.patch(poll._id, { showResults: true });
    await ctx.db.patch(room._id, { updatedAt: Date.now() });
  },
});

export const closePoll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    if (room.activePollId) await deactivatePoll(ctx, room.activePollId);
    // Back to the lesson, keeping the previous currentContent untouched.
    await ctx.db.patch(room._id, {
      mode: "lesson",
      activePollId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Teacher's live tally, including the correct answer (teacher may see it). */
export const getPollVotes = query({
  args: { pollId: v.id("polls") },
  handler: async (ctx, { pollId }) => {
    await requireTeacher(ctx);
    const poll = await ctx.db.get(pollId);
    if (!poll) return null;
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_poll", (q) => q.eq("pollId", pollId))
      .collect();
    const counts = poll.options.map(() => 0);
    for (const vote of votes) {
      if (vote.selectedOption >= 0 && vote.selectedOption < counts.length) {
        counts[vote.selectedOption]++;
      }
    }
    return {
      pollId,
      question: poll.question,
      options: poll.options,
      correctIndex: poll.correctIndex,
      showResults: poll.showResults,
      isActive: poll.isActive,
      counts,
      total: votes.length,
    };
  },
});
