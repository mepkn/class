import { ConvexError } from "convex/values";

/** A message to show: the backend's ConvexError text, else a generic one. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Check your connection and try again.";
}

export type AuthStep = "signIn" | "verify" | "forgot" | "reset";

// Convex Auth reports bad credentials and codes as plain errors (production hides their text).
export function signInErrorMessage(error: unknown, step: AuthStep = "signIn"): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  if (step === "verify" || step === "reset") return "That code is wrong or has expired.";
  if (step === "forgot") return "Could not send a reset code.";
  return "Could not sign in. Check your email and password.";
}
