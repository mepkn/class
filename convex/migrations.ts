import { internalMutation } from "./_generated/server";

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
