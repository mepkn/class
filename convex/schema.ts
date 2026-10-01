import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  lessons: defineTable({
    lessonNumber: v.string(), // "1", "1.2", "1.2.3" (see convex/lib/lessonNumber.ts)
    title: v.string(),
    content: v.string(), // Markdown
    isLocked: v.boolean(), // true = teacher cannot push it to the room yet
    isHidden: v.boolean(), // true = hidden from the teacher's drawer list (archived)
  }).index("by_number", ["lessonNumber"]),

  // SINGLETON: exactly one document, ever
  classroomState: defineTable({
    mode: v.union(v.literal("intro"), v.literal("lesson"), v.literal("poll")),
    activeLessonId: v.optional(v.id("lessons")),
    currentContent: v.string(), // Markdown currently shown to students
    activePollId: v.optional(v.id("polls")),
    updatedAt: v.number(),
  }),

  polls: defineTable({
    question: v.string(),
    options: v.array(v.string()), // 2–4 items
    correctIndex: v.number(),
    showResults: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }),

  votes: defineTable({
    pollId: v.id("polls"),
    voterToken: v.string(),
    selectedOption: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_voter", ["pollId", "voterToken"]),
});
