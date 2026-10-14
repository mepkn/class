import { describe, expect, it } from "vitest";
import { lessonSlides, POLL_MARKER } from "./slide";

describe("lessonSlides", () => {
  const source = "# One\n%% say hi\nmore\n\n---\n\nTwo\n\n```poll\nQ?\n- a\n- [x] b\n```\n\nafter";

  it("splits slides and keeps notes in place", () => {
    expect(lessonSlides(source)[0]).toEqual([
      { kind: "text", text: "# One" },
      { kind: "note", text: "say hi" },
      { kind: "text", text: "more" },
    ]);
  });

  it("replaces poll blocks with a marker", () => {
    expect(lessonSlides(source)[1]).toEqual([{ kind: "text", text: `Two\n\n${POLL_MARKER}\n\nafter` }]);
  });

  it("an empty board is one empty slide", () => {
    expect(lessonSlides("")).toEqual([[]]);
  });
});
