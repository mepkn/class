import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Reads the singleton room document (or null if it hasn't been created yet). */
export async function readRoom(ctx: QueryCtx): Promise<Doc<"classroomState"> | null> {
  return await ctx.db.query("classroomState").first();
}

/**
 * Returns the singleton room, creating it if missing. If duplicates ever
 * exist (should be impossible), the oldest wins and the rest are deleted.
 */
export async function ensureRoom(ctx: MutationCtx): Promise<Doc<"classroomState">> {
  const rooms = await ctx.db.query("classroomState").order("asc").take(10);
  if (rooms.length > 0) {
    for (const extra of rooms.slice(1)) await ctx.db.delete(extra._id);
    return rooms[0];
  }
  const id = await ctx.db.insert("classroomState", {
    mode: "intro",
    currentContent: "",
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export const MAX_CONTENT_BYTES = 200 * 1024;

export function assertContentSize(content: string) {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > MAX_CONTENT_BYTES) {
    throw new ConvexError(`Content too large (${bytes} bytes, max ${MAX_CONTENT_BYTES})`);
  }
}

/** Marks a poll inactive (no-op if it's already inactive or gone). */
export async function deactivatePoll(ctx: MutationCtx, pollId: Id<"polls">) {
  const poll = await ctx.db.get(pollId);
  if (poll && poll.isActive) await ctx.db.patch(pollId, { isActive: false });
}
