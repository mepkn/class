import { internalMutation } from "./_generated/server";
import { lessonNumberFields } from "./lib/lessonNumber";

/** One-off: numeric lessonNumber (5) → string ("5"). Safe to re-run. */
export const lessonNumbersToString = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    for (const lesson of await ctx.db.query("lessons").collect()) {
      if (typeof lesson.lessonNumber === "number") {
        await ctx.db.patch(lesson._id, { lessonNumber: String(lesson.lessonNumber) });
        migrated++;
      }
    }
    return { migrated };
  },
});

/** One-off: slide mode became a global room setting; drop the old per-lesson value. */
export const dropLessonSlideMode = internalMutation({
  args: {},
  handler: async (ctx) => {
    let cleared = 0;
    for (const lesson of await ctx.db.query("lessons").collect()) {
      if ((lesson as { slideMode?: unknown }).slideMode !== undefined) {
        await ctx.db.patch(lesson._id, { slideMode: undefined } as never);
        cleared++;
      }
    }
    return { cleared };
  },
});

/** One-off: backfill `topLevel` (used by createLesson's next-number lookup). Safe to re-run. */
export const backfillTopLevel = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    for (const lesson of await ctx.db.query("lessons").collect()) {
      const { topLevel } = lessonNumberFields(lesson.lessonNumber);
      if (lesson.topLevel !== topLevel) {
        await ctx.db.patch(lesson._id, { topLevel });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * One-off: polls became saved polls + temporary runs. Deletes every old poll (the ones with
 * the legacy `isActive` flag) and every old vote, and clears the room's old poll link.
 */
export const dropOldPolls = internalMutation({
  args: {},
  handler: async (ctx) => {
    let votes = 0;
    let polls = 0;
    for (const vote of await ctx.db.query("votes").collect()) {
      if (vote.runId === undefined) {
        await ctx.db.delete(vote._id);
        votes++;
      }
    }
    for (const poll of await ctx.db.query("polls").collect()) {
      if (poll.isActive !== undefined) {
        await ctx.db.delete(poll._id);
        polls++;
      }
    }
    for (const room of await ctx.db.query("classroomState").collect()) {
      if (room.activePollId !== undefined) {
        await ctx.db.patch(room._id, {
          activePollId: undefined,
          ...(room.mode === "poll" && !room.activeRunId ? { mode: "lesson" as const } : {}),
        });
      }
    }
    return { polls, votes };
  },
});
