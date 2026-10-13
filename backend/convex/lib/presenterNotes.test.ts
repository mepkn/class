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
    expect(showPresenterNotes("%% say hi")).toBe("\n> 📝 **Note:** say hi\n");
    expect(showPresenterNotes("%%")).toContain("…");
  });
});
