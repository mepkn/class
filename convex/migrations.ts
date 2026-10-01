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
