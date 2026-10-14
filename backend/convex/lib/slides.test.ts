import { describe, expect, it } from "vitest";
import { clampSlide, splitSlides } from "./slides";

describe("splitSlides", () => {
  it("splits on --- after a blank line", () => {
    expect(splitSlides("# One\n\n---\n\n# Two")).toEqual(["# One", "# Two"]);
  });
  it("keeps setext headings (--- right after text)", () => {
    expect(splitSlides("Heading\n---\nbody")).toEqual(["Heading\n---\nbody"]);
  });
  it("never splits inside a code fence", () => {
    const md = "```\n\n---\n```";
    expect(splitSlides(md)).toEqual([md]);
  });
  it("handles longer fences that wrap a shorter one", () => {
    const md = "````md\n```\n\n---\n```\n````";
    expect(splitSlides(md)).toEqual([md]);
  });
  it("never splits inside a %% note block", () => {
    expect(splitSlides("a\n\n%%\nnote\n\n---\n\nmore\n%%\n\n---\n\nb")).toHaveLength(2);
  });
  it("ignores a leading separator", () => {
    expect(splitSlides("---\n\n# One")).toEqual(["# One"]);
  });
});

describe("clampSlide", () => {
  it("clamps into range", () => {
    expect(clampSlide(-1, 3)).toBe(0);
    expect(clampSlide(5, 3)).toBe(2);
    expect(clampSlide(1.7, 3)).toBe(1);
    expect(clampSlide(NaN, 3)).toBe(0);
    expect(clampSlide(2, 0)).toBe(0);
  });
});
