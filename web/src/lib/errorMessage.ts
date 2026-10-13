import { ConvexError } from "convex/values";

/** Human-readable message from a Convex call failure. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : fallback;
  if (err instanceof Error) {
    const m = /Uncaught (?:Convex)?Error: (.*)/.exec(err.message);
    return (m?.[1] ?? err.message).split("\n")[0] || fallback;
  }
  return fallback;
}
