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
    activeRunId: v.optional(v.id("pollRuns")), // a saved poll launched by hand: takes over the screen
    activePollId: v.optional(v.id("polls")), // LEGACY: cleared by migrations:dropOldPolls
    updatedAt: v.number(),
    pushedAt: v.optional(v.number()), // set on Push to Room / Blank Blackboard (drives the duster wipe)
    dusterEnabled: v.optional(v.boolean()), // duster animation on students' screens (default on)
    slideMode: v.optional(slideMode), // global: how `---` slides advance (default "build")
    currentSlide: v.optional(v.number()), // 0-based slide within currentContent (see convex/lib/slides.ts)
    boardColor: v.optional(v.string()), // id from convex/lib/boardColors.ts (default "green")
  }),

  // Polls written ahead: lesson polls (ownerLessonId set, deleted with the lesson) and bank
  // polls (no owner, reusable, linked to lessons via lessonPolls). Inline polls live in the
  // lesson Markdown (convex/lib/inlinePolls.ts) and never get a row here.
  polls: defineTable({
    question: v.string(), // Markdown
    options: v.array(v.string()), // 2–6 (convex/lib/pollRules.ts)
    correctIndex: v.optional(v.number()), // unset = opinion poll
    ownerLessonId: v.optional(v.id("lessons")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // LEGACY optional: old rows lack it
    showResults: v.optional(v.boolean()), // LEGACY
    isActive: v.optional(v.boolean()), // LEGACY
  })
    .index("by_owner", ["ownerLessonId"])
    .searchIndex("search_question", { searchField: "question" }),

  // A lesson's Polls tab, in order: its own polls and linked bank polls.
  lessonPolls: defineTable({
    lessonId: v.id("lessons"),
    pollId: v.id("polls"),
    order: v.number(),
  })
    .index("by_lesson", ["lessonId", "order"])
    .index("by_poll", ["pollId"]),

  // One showing of a poll in class. Temporary: deleted (with its votes) when a saved poll is
  // closed, and all of them on Push to Room / Blank Blackboard. Nothing is kept between classes.
  pollRuns: defineTable({
    kind: v.union(v.literal("inline"), v.literal("saved")),
    pollId: v.optional(v.id("polls")), // saved
    slide: v.optional(v.number()), // inline: 0-based slide…
    blockIndex: v.optional(v.number()), // …and which ```poll block on it
    question: v.string(), // snapshot at launch
    options: v.array(v.string()),
    correctIndex: v.optional(v.number()),
    open: v.boolean(), // accepting votes
    revealed: v.boolean(), // students see results (and the answer)
  })
    .index("by_slide", ["kind", "slide", "blockIndex"])
    .index("by_poll", ["pollId"]),

  votes: defineTable({
    runId: v.optional(v.id("pollRuns")), // LEGACY optional: old rows have pollId instead
    pollId: v.optional(v.id("polls")), // LEGACY
    voterToken: v.string(),
    selectedOption: v.number(),
  })
    .index("by_run", ["runId"])
    .index("by_run_voter", ["runId", "voterToken"]),
});
