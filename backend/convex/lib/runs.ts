import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Votes per option for a run. */
export async function tallyRun(ctx: QueryCtx, run: Doc<"pollRuns">) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_run", (q) => q.eq("runId", run._id))
    .collect();
  const counts = run.options.map(() => 0);
  for (const vote of votes) {
    if (vote.selectedOption >= 0 && vote.selectedOption < counts.length) counts[vote.selectedOption]++;
  }
  return { counts, total: votes.length };
}

/** Deletes a run and its votes (no-op if it's already gone). */
export async function deleteRun(ctx: MutationCtx, runId: Id<"pollRuns">) {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_run", (q) => q.eq("runId", runId))
    .collect();
  for (const vote of votes) await ctx.db.delete(vote._id);
  if (await ctx.db.get(runId)) await ctx.db.delete(runId);
}

/** Deletes every run and vote: a fresh start (Push to Room, Blank Blackboard). */
export async function clearRuns(ctx: MutationCtx) {
  for (const run of await ctx.db.query("pollRuns").collect()) await deleteRun(ctx, run._id);
}
