import { describe, expect, it } from "vitest";
import {
  compareLessonNumbers,
  isDescendant,
  lessonNumberFields,
  normalizeLessonNumber,
  parentNumber,
} from "./lessonNumber";

describe("normalizeLessonNumber", () => {
  it("trims and strips leading zeros", () => {
    expect(normalizeLessonNumber(" 01.02 ")).toBe("1.2");
  });
  it("rejects invalid input", () => {
    for (const bad of ["", "a", "1.", ".1", "1..2", "0", "1.0", "-1"]) {
      expect(normalizeLessonNumber(bad), bad).toBeNull();
    }
  });
});

describe("compareLessonNumbers", () => {
  it("orders segment by segment", () => {
    const sorted = ["2", "1.10", "1", "1.2", "1.1"].sort(compareLessonNumbers);
    expect(sorted).toEqual(["1", "1.1", "1.2", "1.10", "2"]);
  });
});

describe("tree helpers", () => {
  it("finds the parent", () => {
    expect(parentNumber("1.2.3")).toBe("1.2");
    expect(parentNumber("4")).toBeNull();
  });
  it("sets topLevel only for top-level lessons", () => {
    expect(lessonNumberFields("3")).toEqual({ lessonNumber: "3", topLevel: 3 });
    expect(lessonNumberFields("3.1")).toEqual({ lessonNumber: "3.1", topLevel: undefined });
  });
  it("detects descendants strictly", () => {
    expect(isDescendant("1.2.3", "1.2")).toBe(true);
    expect(isDescendant("1.2", "1.2")).toBe(false);
    expect(isDescendant("1.20", "1.2")).toBe(false);
  });
});
