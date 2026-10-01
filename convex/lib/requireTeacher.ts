import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { isTeacherEmail } from "./teachers";

/**
 * Throws unless the caller is signed in AND their email is in TEACHER_EMAILS.
 * Every teacher query/mutation must call this first.
 * (MutationCtx extends QueryCtx, so this works for both.)
 */
export async function requireTeacher(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("Not authenticated");
  if (!isTeacherEmail(user.email)) throw new ConvexError("Not authorized: teacher only");
  return user;
}
