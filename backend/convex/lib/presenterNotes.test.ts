import { describe, expect, it } from "vitest";
import { showPresenterNotes, stripPresenterNotes } from "./presenterNotes";

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
