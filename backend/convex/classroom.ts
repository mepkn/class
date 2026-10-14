import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import {
  compareLessonNumbers,
  isDescendant,
  lessonNumberFields,
  normalizeLessonNumber,
  parentNumber,
  segments,
} from "./lib/lessonNumber";
import type { Doc, Id } from "./_generated/dataModel";
import { BOARD_COLORS, DEFAULT_BOARD_COLOR } from "./lib/boardColors";
import { stripPresenterNotes } from "./lib/presenterNotes";
import { clampSlide, splitSlides } from "./lib/slides";
import { pollNumbers, slideMode } from "./schema";
import { requireTeacher } from "./lib/requireTeacher";
import { assertContentSize, ensureRoom, readRoom } from "./lib/room";
import { clearRuns, tallyRun } from "./lib/runs";
import { syncInlineRuns } from "./lib/inlineRuns";
import { pollsInContent } from "./lib/inlinePolls";
import { normalizeLink } from "./lib/links";
import { blockedLinksIn, checkLinksIn } from "./links";

// ---------------------------------------------------------------------------
// Public (anonymous)
// ---------------------------------------------------------------------------

/**
 * The one subscription every student (and the teacher's monitor) uses.
 * A poll's `correctIndex` and vote counts are only included once its results are revealed.
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const room = await readRoom(ctx);
    if (!room) {
      return {
        mode: "intro" as const,
        currentContent: "",
        activeLessonId: null,
        pushedAt: null,
        slide: { index: 0, count: 1 },
        revealed: [] as { slide: number; content: string }[],
        dusterEnabled: true,
        boardColor: DEFAULT_BOARD_COLOR as string,
        slideMode: "build" as "build" | "replace",
        pollNumbers: "percent" as "percent" | "count",
        paused: false,
        poll: null,
        inlinePolls: [],
        link: null as string | null,
        linksClosedAt: null as number | null,
        blockedLinks: [] as string[],
      };
    }

    const numbers = room.pollNumbers ?? "percent";

    // A saved poll launched by hand: it replaces the lesson on screen.
    let poll = null;
    if (room.mode === "poll" && room.activeRunId) {
      const run = await ctx.db.get(room.activeRunId);
      if (run) {
        poll = {
          _id: run._id,
          question: run.question,
          options: run.options,
          showResults: run.revealed,
          results: run.revealed
            ? { correctIndex: run.correctIndex ?? null, numbers, ...(await tallyRun(ctx, run)) }
            : null,
        };
      }
    }

    const slides = splitSlides(room.currentContent);
    const slideIndex = clampSlide(room.currentSlide ?? 0, slides.length);
    const first = (room.slideMode ?? "build") === "replace" ? slideIndex : 0;
    const revealed = slides
      .slice(first, slideIndex + 1)
      .map((part, i) => ({ slide: first + i, content: stripPresenterNotes(part).trim() }))
      .filter((part) => part.content !== "");

    // Inline polls on the slides students can see, in slide and block order.
    const runs =
      room.mode === "lesson"
        ? await ctx.db
            .query("pollRuns")
            .withIndex("by_slide", (q) => q.eq("kind", "inline").gte("slide", first).lte("slide", slideIndex))
            .collect()
        : [];
    const inlinePolls = await Promise.all(
      runs.map(async (run) => ({
        slide: run.slide ?? 0,
        blockIndex: run.blockIndex ?? 0,
        _id: run._id,
        question: run.question,
        options: run.options,
        showResults: run.revealed,
        results: run.revealed
          ? { correctIndex: run.correctIndex ?? null, numbers, ...(await tallyRun(ctx, run)) }
          : null,
      })),
    );

    const currentContent = revealed.map((part) => part.content).join("\n\n");
    return {
      mode: room.mode,
      // Build-up: slides 1..current are shown together; replace: only the current one.
      // Presenter notes (`%%` lines) are stripped. Students never see upcoming slides.
      currentContent,
      revealed,
      slide: { index: slideIndex, count: slides.length },
      activeLessonId: room.activeLessonId ?? null,
      pushedAt: room.pushedAt ?? null,
      dusterEnabled: room.dusterEnabled ?? true,
      boardColor: room.boardColor ?? DEFAULT_BOARD_COLOR,
      slideMode: room.slideMode ?? "build",
      pollNumbers: numbers,
      paused: room.paused ?? false,
      poll,
      inlinePolls,
      link: room.link ?? null,
      linksClosedAt: room.linksClosedAt ?? null,
      // Links on the board whose site refuses the in-page panel: they open in a new tab.
      blockedLinks: await blockedLinksIn(ctx, currentContent),
    };
  },
});

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

export const ensureClassroomState = internalMutation({
  args: {},
  handler: async (ctx) => {
    const room = await ensureRoom(ctx);
    return room._id;
  },
});

// ---------------------------------------------------------------------------
// Teacher only
// ---------------------------------------------------------------------------

/** Teacher only: the live board's full source, including presenter notes. */
export const getLiveSource = query({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await readRoom(ctx);
    return room?.currentContent ?? "";
  },
});

/** A lesson without its Markdown body: what the sidebar list needs. */
export type LessonSummary = Omit<Doc<"lessons">, "content">;

/**
 * The sidebar list, without `content`: lessons can be up to 200 KB each, and this
 * query re-sends the whole list on every lesson change. Bodies load via `getLesson`.
 */
export const getLessons = query({
  args: {},
  handler: async (ctx): Promise<LessonSummary[]> => {
    await requireTeacher(ctx);
    const lessons = await ctx.db.query("lessons").collect();
    return lessons
      .sort((a, b) => compareLessonNumbers(a.lessonNumber, b.lessonNumber))
      .map(({ content: _content, ...summary }) => summary);
  },
});

/** One lesson including its Markdown body (null if it was deleted). */
export const getLesson = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await requireTeacher(ctx);
    return await ctx.db.get(lessonId);
  },
});

/** Lessons whose number is strictly inside `num`'s subtree ("1" → "1.1", "1.2.3", …). */
async function descendantsOf(ctx: QueryCtx, num: string) {
  // "." < "/" in ASCII, so [num + ".", num + "/") is exactly the subtree.
  return await ctx.db
    .query("lessons")
    .withIndex("by_number", (q) => q.gte("lessonNumber", num + ".").lt("lessonNumber", num + "/"))
    .collect();
}

/** True while students are actually viewing this lesson. */
async function isLiveLesson(ctx: QueryCtx, lessonId: Id<"lessons">) {
  const room = await readRoom(ctx);
  return room?.mode === "lesson" && room.activeLessonId === lessonId;
}

async function lessonByNumber(ctx: QueryCtx, num: string) {
  return await ctx.db
    .query("lessons")
    .withIndex("by_number", (q) => q.eq("lessonNumber", num))
    .first();
}

export const updateLesson = mutation({
  args: {
    lessonId: v.id("lessons"),
    lessonNumber: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    isLocked: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { lessonId, lessonNumber, ...patch }) => {
    await requireTeacher(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new ConvexError("Lesson not found");
    if ((patch.isLocked === true || patch.isHidden === true) && (await isLiveLesson(ctx, lessonId))) {
      throw new ConvexError("Can't lock or hide the lesson students are viewing");
    }
    if (patch.content !== undefined) assertContentSize(patch.content);
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title || title.length > 200) throw new ConvexError("Title must be 1–200 characters");
      patch.title = title;
    }

    // Renumbering moves the lesson's whole subtree with it (1 → 3 turns 1.2 into 3.2).
    if (lessonNumber !== undefined) {
      const next = normalizeLessonNumber(lessonNumber);
      if (!next) throw new ConvexError("Number must look like 4, 4.1 or 4.1.2");
      const prev = lesson.lessonNumber;
      if (next !== prev) {
        if (isDescendant(next, prev)) {
          throw new ConvexError("A lesson can't be moved inside itself");
        }
        const parent = parentNumber(next);
        if (parent && !(await lessonByNumber(ctx, parent))) {
          throw new ConvexError(`Lesson ${parent} must exist before ${next}`);
        }
        const subtree = await descendantsOf(ctx, prev);
        const moves = [
          { id: lesson._id, to: next },
          ...subtree.map((d) => ({ id: d._id, to: next + d.lessonNumber.slice(prev.length) })),
        ];
        const moving = new Set(moves.map((m) => m.id));
        for (const m of moves) {
          const clash = await lessonByNumber(ctx, m.to);
          if (clash && !moving.has(clash._id)) {
            throw new ConvexError(`Lesson ${m.to} already exists`);
          }
        }
        for (const m of moves) await ctx.db.patch(m.id, lessonNumberFields(m.to));
      }
    }

    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(lessonId, clean);
    if (patch.content !== undefined) await checkLinksIn(ctx, patch.content);
  },
});

/**
 * Creates a lesson, locked, with a stub title.
 * No parent → next top-level number. With parent → next child ("1" → "1.1", "1.2", …).
 */
export const createLesson = mutation({
  args: { parentId: v.optional(v.id("lessons")) },
  handler: async (ctx, { parentId }) => {
    await requireTeacher(ctx);
    let prefix = "";
    let lastSegment: number;
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent) throw new ConvexError("Parent lesson not found");
      prefix = parent.lessonNumber + ".";
      const siblings = (await descendantsOf(ctx, parent.lessonNumber))
        .map((l) => l.lessonNumber)
        .filter((n) => parentNumber(n) === parent.lessonNumber);
      lastSegment = Math.max(0, ...siblings.map((n) => segments(n).at(-1)!));
    } else {
      const last = await ctx.db.query("lessons").withIndex("by_top_level").order("desc").first();
      lastSegment = last?.topLevel ?? 0;
    }
    // Guard against lessons written before `topLevel` was backfilled: never reuse a number.
    let next = lastSegment + 1;
    while (await lessonByNumber(ctx, prefix + next)) next++;
    const lessonNumber = prefix + next;
    return await ctx.db.insert("lessons", {
      ...lessonNumberFields(lessonNumber),
      title: `Lesson ${lessonNumber}`,
      content: `# Lesson ${lessonNumber}\n\n`,
      isLocked: true,
      isHidden: false,
    });
  },
});

/** What deleting a lesson takes with it: its own polls (saved + inline) and linked bank polls. */
async function lessonPolls(ctx: QueryCtx, lesson: Doc<"lessons">) {
  const links = await ctx.db
    .query("lessonPolls")
    .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
    .collect();
  const own = await ctx.db
    .query("polls")
    .withIndex("by_owner", (q) => q.eq("ownerLessonId", lesson._id))
    .collect();
  return { links, own, inline: pollsInContent(lesson.content).length };
}

/** Counts for the delete-lesson confirmation. */
export const lessonPollCount = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await requireTeacher(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const { links, own, inline } = await lessonPolls(ctx, lesson);
    return { deleted: own.length + inline, bankLinked: links.length - own.length };
  },
});

/**
 * Deletes a lesson and its own polls. Blocked while students are viewing it or while it has sub-lessons.
 * (If it was live earlier — e.g. before a Reset — the room's link to it is cleared.)
 */
export const deleteLesson = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await requireTeacher(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new ConvexError("Lesson not found");
    if (await isLiveLesson(ctx, lessonId)) {
      throw new ConvexError("Can't delete the lesson students are viewing");
    }
    const children = await descendantsOf(ctx, lesson.lessonNumber);
    if (children.length > 0) {
      throw new ConvexError(
        `Lesson ${lesson.lessonNumber} has ${children.length} sub-lesson(s). Delete or move them first.`,
      );
    }
    const room = await readRoom(ctx);
    if (room?.activeLessonId === lessonId) {
      await ctx.db.patch(room._id, { activeLessonId: undefined, updatedAt: Date.now() });
    }
    // Its own polls go with it; bank polls it used stay in the bank (only the links go).
    const { links, own } = await lessonPolls(ctx, lesson);
    for (const link of links) await ctx.db.delete(link._id);
    for (const poll of own) {
      const elsewhere = await ctx.db
        .query("lessonPolls")
        .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
        .collect();
      for (const link of elsewhere) await ctx.db.delete(link._id);
      await ctx.db.delete(poll._id);
    }
    await ctx.db.delete(lessonId);
  },
});

export const pushLesson = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    await requireTeacher(ctx);
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) throw new ConvexError("Lesson not found");
    if (lesson.isLocked) throw new ConvexError("Lesson is locked");
    const room = await ensureRoom(ctx);
    await clearRuns(ctx); // fresh start: every poll's votes go
    await ctx.db.patch(room._id, {
      mode: "lesson",
      activeLessonId: lessonId,
      currentContent: lesson.content,
      pushedAt: Date.now(),
      currentSlide: 0,
      activeRunId: undefined,
      link: undefined,
      paused: undefined,
      updatedAt: Date.now(),
    });
    await syncInlineRuns(ctx, lesson.content, 0);
    await checkLinksIn(ctx, lesson.content);
  },
});

export const pushBlankBoard = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await clearRuns(ctx); // fresh start: every poll's votes go
    await ctx.db.patch(room._id, {
      mode: "lesson",
      activeLessonId: undefined,
      currentContent: "",
      pushedAt: Date.now(),
      currentSlide: 0,
      activeRunId: undefined,
      link: undefined,
      paused: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const updateLiveContent = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    await requireTeacher(ctx);
    assertContentSize(content);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { currentContent: content, updatedAt: Date.now() });
    // An edited inline poll starts again; the rest keep their votes.
    await syncInlineRuns(ctx, content, clampSlide(room.currentSlide ?? 0, splitSlides(content).length));
    await checkLinksIn(ctx, content, { live: true });
  },
});

/** Turns the duster wipe (shown to students on Push to Room / Blank Blackboard) on or off. */
export const setDusterAnimation = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { dusterEnabled: enabled });
  },
});

/** Changes the board background every student sees. */
export const setBoardColor = mutation({
  args: { color: v.string() },
  handler: async (ctx, { color }) => {
    await requireTeacher(ctx);
    if (!BOARD_COLORS.some((c) => c.id === color)) throw new ConvexError("Unknown board color");
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { boardColor: color });
  },
});

/** Shows slide `index` (0-based) of the live board; clamped to the slides that exist. */
export const setSlide = mutation({
  args: { index: v.number() },
  handler: async (ctx, { index }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    const next = clampSlide(index, splitSlides(room.currentContent).length);
    if (next !== (room.currentSlide ?? 0)) {
      await ctx.db.patch(room._id, { currentSlide: next, link: undefined, updatedAt: Date.now() });
      await syncInlineRuns(ctx, room.currentContent, next);
    }
    return next;
  },
});

/** Pause: students see an empty board and can't vote, until Resume puts everything back. */
export const setPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, { paused }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { paused: paused || undefined, updatedAt: Date.now() });
  },
});

/** Global: whether revealed poll results show percentages or vote counts. */
export const setPollNumbers = mutation({
  args: { numbers: pollNumbers },
  handler: async (ctx, { numbers }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { pollNumbers: numbers, updatedAt: Date.now() });
  },
});

/** Global: how `---` slides advance for every lesson ("build" adds, "replace" swaps). */
export const setSlideMode = mutation({
  args: { mode: slideMode },
  handler: async (ctx, { mode }) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { slideMode: mode, updatedAt: Date.now() });
  },
});

/** Opens a web page on every student's screen, over the board. Only `closeLinks` closes it. */
export const showLink = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    await requireTeacher(ctx);
    const link = normalizeLink(url);
    if (!link) throw new ConvexError("That isn't a web address (http or https)");
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { link, paused: undefined, updatedAt: Date.now() });
    return link;
  },
});

/** "Back to board": closes the teacher's link and every link a student opened themselves. */
export const closeLinks = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    await ctx.db.patch(room._id, { link: undefined, linksClosedAt: Date.now(), updatedAt: Date.now() });
  },
});
