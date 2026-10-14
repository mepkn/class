import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { parsePollBlocks } from "./inlinePolls";
import type { PollInput } from "./pollRules";
import { deleteRun } from "./runs";
import { splitSlides } from "./slides";

/** The valid inline polls on each slide (null where a block has an error). */
export function inlinePollsBySlide(content: string): (PollInput | null)[][] {
  return splitSlides(content).map((slide) =>
    parsePollBlocks(slide).map((block) => ("poll" in block ? block.poll : null)),
  );
}

function sameAs(run: Doc<"pollRuns">, poll: PollInput | null | undefined): boolean {
  return (
    !!poll &&
    run.question === poll.question &&
    run.correctIndex === poll.correctIndex &&
    run.options.length === poll.options.length &&
    run.options.every((o, i) => o === poll.options[i])
  );
}

/** Starts an inline poll with no votes. */
export async function startInlineRun(ctx: MutationCtx, slide: number, blockIndex: number, poll: PollInput) {
  return await ctx.db.insert("pollRuns", {
    kind: "inline",
    slide,
    blockIndex,
    question: poll.question,
    options: poll.options,
    correctIndex: poll.correctIndex,
    open: true,
    revealed: false,
  });
}

/**
 * Brings inline runs in line with the board after the slide or the content changed:
 * - a run whose poll was edited or removed is deleted (an edited poll starts again);
 * - runs on other slides stop voting and show their results (you moved on);
 * - polls on the current slide without a run start one. Ones that already ran keep their
 *   results; the teacher can Run again.
 */
export async function syncInlineRuns(ctx: MutationCtx, content: string, currentSlide: number) {
  const polls = inlinePollsBySlide(content);
  const runs = await ctx.db
    .query("pollRuns")
    .withIndex("by_slide", (q) => q.eq("kind", "inline"))
    .collect();
  const kept = new Set<string>();
  for (const run of runs) {
    const slide = run.slide ?? -1;
    const blockIndex = run.blockIndex ?? -1;
    const key = `${slide}:${blockIndex}`;
    if (!sameAs(run, polls[slide]?.[blockIndex]) || kept.has(key)) {
      await deleteRun(ctx, run._id);
      continue;
    }
    kept.add(key);
    if (slide !== currentSlide && run.open) await ctx.db.patch(run._id, { open: false, revealed: true });
  }
  const here = polls[currentSlide] ?? [];
  for (let i = 0; i < here.length; i++) {
    const poll = here[i];
    if (poll && !kept.has(`${currentSlide}:${i}`)) await startInlineRun(ctx, currentSlide, i, poll);
  }
}
