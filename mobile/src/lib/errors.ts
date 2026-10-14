import { ConvexError } from "convex/values";

/** A message to show: the backend's ConvexError text, else a generic one. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Check your connection and try again.";
}

// Convex Auth reports bad credentials as plain errors (production hides their text).
export function signInErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Could not sign in. Check your email and password.";
}
