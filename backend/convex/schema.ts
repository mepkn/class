import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// "build": each step adds the next slide under the previous ones. "replace": one slide at a time.
export const slideMode = v.union(v.literal("build"), v.literal("replace"));

export default defineSchema({
  ...authTables,

  lessons: defineTable({
    lessonNumber: v.string(), // "1", "1.2", "1.2.3" (see convex/lib/lessonNumber.ts)
    title: v.string(),
    content: v.string(), // Markdown
    isLocked: v.boolean(), // true = teacher cannot push it to the room yet
    isHidden: v.boolean(), // true = hidden from the teacher's drawer list (archived)
    // Top-level lessons only: Number(lessonNumber), so the next number is one index read
    // (string order puts "10" before "9"). Unset for sub-lessons. See lessonNumberFields().
    topLevel: v.optional(v.number()),
  })
    .index("by_number", ["lessonNumber"])
    .index("by_top_level", ["topLevel"]),

  // SINGLETON: exactly one document, ever
  classroomState: defineTable({
    mode: v.union(v.literal("intro"), v.literal("lesson"), v.literal("poll")),
    activeLessonId: v.optional(v.id("lessons")),
    currentContent: v.string(), // Markdown currently shown to students
    activePollId: v.optional(v.id("polls")),
    updatedAt: v.number(),
    pushedAt: v.optional(v.number()), // set on Push to Room / Blank Blackboard (drives the duster wipe)
    dusterEnabled: v.optional(v.boolean()), // duster animation on students' screens (default on)
    slideMode: v.optional(slideMode), // global: how `---` slides advance (default "build")
    currentSlide: v.optional(v.number()), // 0-based slide within currentContent (see convex/lib/slides.ts)
    boardColor: v.optional(v.string()), // id from convex/lib/boardColors.ts (default "green")
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
