import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import {
  compareLessonNumbers,
  isDescendant,
  normalizeLessonNumber,
  parentNumber,
  segments,
} from "./lib/lessonNumber";
import type { Id } from "./_generated/dataModel";
import { requireTeacher } from "./lib/requireTeacher";
import { assertContentSize, deactivatePoll, ensureRoom, readRoom } from "./lib/room";

// ---------------------------------------------------------------------------
// Public (anonymous)
// ---------------------------------------------------------------------------

/**
 * The one subscription every student (and the teacher's monitor) uses.
 * `correctIndex` and vote counts are only included once results are revealed.
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const room = await readRoom(ctx);
    if (!room) {
      return { mode: "intro" as const, currentContent: "", activeLessonId: null, poll: null };
    }

    let poll = null;
    if (room.mode === "poll" && room.activePollId) {
      const p = await ctx.db.get(room.activePollId);
      if (p && p.isActive) {
        let results = null;
        if (p.showResults) {
          const votes = await ctx.db
            .query("votes")
            .withIndex("by_poll", (q) => q.eq("pollId", p._id))
            .collect();
          const counts = p.options.map(() => 0);
          for (const vote of votes) {
            if (vote.selectedOption >= 0 && vote.selectedOption < counts.length) {
              counts[vote.selectedOption]++;
            }
          }
          results = { correctIndex: p.correctIndex, counts, total: votes.length };
        }
        poll = {
          _id: p._id,
          question: p.question,
          options: p.options,
          showResults: p.showResults,
          results,
        };
      }
    }

    return {
      mode: room.mode,
      currentContent: room.currentContent,
      activeLessonId: room.activeLessonId ?? null,
      poll,
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

export const getLessons = query({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const lessons = await ctx.db.query("lessons").collect();
    return lessons.sort((a, b) => compareLessonNumbers(a.lessonNumber, b.lessonNumber));
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
        for (const m of moves) await ctx.db.patch(m.id, { lessonNumber: m.to });
      }
    }

    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(lessonId, clean);
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
    let siblings: string[];
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent) throw new ConvexError("Parent lesson not found");
      prefix = parent.lessonNumber + ".";
      siblings = (await descendantsOf(ctx, parent.lessonNumber))
        .map((l) => l.lessonNumber)
        .filter((n) => parentNumber(n) === parent.lessonNumber);
    } else {
      siblings = (await ctx.db.query("lessons").collect())
        .map((l) => l.lessonNumber)
        .filter((n) => parentNumber(n) === null);
    }
    const lastSegment = Math.max(0, ...siblings.map((n) => segments(n).at(-1)!));
    const lessonNumber = prefix + (lastSegment + 1);
    return await ctx.db.insert("lessons", {
      lessonNumber,
      title: `Lesson ${lessonNumber}`,
      content: `# Lesson ${lessonNumber}\n\n`,
      isLocked: true,
      isHidden: false,
    });
  },
});

/**
 * Deletes a lesson. Blocked while students are viewing it or while it has sub-lessons.
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
    if (room.activePollId) await deactivatePoll(ctx, room.activePollId);
    await ctx.db.patch(room._id, {
      mode: "lesson",
      activeLessonId: lessonId,
      currentContent: lesson.content,
      activePollId: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const pushBlankBoard = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
    const room = await ensureRoom(ctx);
    if (room.activePollId) await deactivatePoll(ctx, room.activePollId);
    await ctx.db.patch(room._id, {
      mode: "lesson",
      activeLessonId: undefined,
      currentContent: "",
      activePollId: undefined,
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
  },
});

