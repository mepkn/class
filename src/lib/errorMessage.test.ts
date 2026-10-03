import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("uses a ConvexError's string data", () => {
    expect(errorMessage(new ConvexError("Poll closed"))).toBe("Poll closed");
    expect(errorMessage(new ConvexError({ code: 1 }))).toBe("Something went wrong");
  });
  it("extracts the message from a server error", () => {
    const err = new Error("[Request ID: x] Server Error\nUncaught Error: Not allowed\n  at handler");
    expect(errorMessage(err)).toBe("Not allowed");
  });
  it("falls back for non-errors", () => {
    expect(errorMessage("nope", "Oops")).toBe("Oops");
  });
});
