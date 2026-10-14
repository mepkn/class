import { describe, expect, it } from "vitest";
import { lessonSlides } from "./slide";

describe("lessonSlides", () => {
  const source = "# One\n%% say hi\nmore\n\n---\n\nTwo\n\n```poll\nQ?\n- a\n- [x] b\n```\n\nafter";

  it("splits slides and keeps notes in place", () => {
    expect(lessonSlides(source)[0]).toEqual([
      { kind: "text", text: "# One" },
      { kind: "note", text: "say hi" },
      { kind: "text", text: "more" },
    ]);
  });

  it("cuts poll blocks out as their own part", () => {
    expect(lessonSlides(source)[1]).toEqual([
      { kind: "text", text: "Two" },
      { kind: "poll", block: { poll: { question: "Q?", options: ["a", "b"], correctIndex: 1 } } },
      { kind: "text", text: "after" },
    ]);
  });

  it("an empty board is one empty slide", () => {
    expect(lessonSlides("")).toEqual([[]]);
  });
});
