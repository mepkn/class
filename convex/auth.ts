import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { isTeacherEmail } from "./lib/teachers";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Runs for every flow. Rejecting non-allowlisted emails here means
      // nobody outside TEACHER_EMAILS can sign up (or sign in).
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!isTeacherEmail(email)) {
          throw new ConvexError("This email is not on the teacher allowlist.");
        }
        return { email };
      },
    }),
  ],
});

/** Who am I? Used by the /teacher route to choose login / denied / dashboard. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { email: user.email ?? null, isTeacher: isTeacherEmail(user.email) };
  },
});
