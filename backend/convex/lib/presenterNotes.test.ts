import { describe, expect, it } from "vitest";
import { presenterNoteParts, showPresenterNotes, stripPresenterNotes } from "./presenterNotes";

describe("presenter notes", () => {
  it("removes %% lines for students", () => {
    expect(stripPresenterNotes("# Title\n  %% say hi\ntext")).toBe("# Title\ntext");
  });
  it("leaves %% inside code fences alone", () => {
    const md = "```python\n%%timeit\n```";
    expect(stripPresenterNotes(md)).toBe(md);
  });
  it("shows notes as callouts for the teacher", () => {
    expect(showPresenterNotes("%% say hi")).toBe("\n> 📝 say hi\n");
    expect(showPresenterNotes("%%\n%%")).toContain("…");
  });
  it("handles %% … %% note blocks", () => {
    expect(stripPresenterNotes("a\n%%\nsecret\n```\nmore\n%%\nb")).toBe("a\nb");
    expect(showPresenterNotes("%%\none\n\ntwo\n%%")).toBe("\n> 📝 one\n>\n> two\n");
  });
  it("hides an unclosed block to the end", () => {
    expect(stripPresenterNotes("a\n%%\nsecret")).toBe("a");
  });
});

describe("presenterNoteParts", () => {
  it("keeps each note where it was written", () => {
    expect(presenterNoteParts("# A\n%% first\ntext\n%%\nblock\n%%\nend")).toEqual([
      { kind: "text", text: "# A" },
      { kind: "note", text: "first" },
      { kind: "text", text: "text" },
      { kind: "note", text: "block" },
      { kind: "text", text: "end" },
    ]);
  });
  it("leaves %% in code alone", () => {
    expect(presenterNoteParts("```\n%%timeit\n```")).toEqual([{ kind: "text", text: "```\n%%timeit\n```" }]);
  });
});
