// Hierarchical lesson numbers stored as strings: "1", "1.2", "1.2.3" (unlimited depth).
// Shared by the backend and the teacher UI.

const PATTERN = /^\d+(\.\d+)*$/;

/** Trims and strips leading zeros per segment ("01.02" → "1.2"); null if invalid. */
export function normalizeLessonNumber(raw: string): string | null {
  const s = raw.trim();
  if (!PATTERN.test(s)) return null;
  const parts = s.split(".").map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n) || n < 1)) return null;
  return parts.join(".");
}

export function segments(num: string): number[] {
  return num.split(".").map(Number);
}

/** Segment-wise order: 1 < 1.1 < 1.2 < 1.10 < 2. */
export function compareLessonNumbers(a: string, b: string): number {
  const x = segments(a);
  const y = segments(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

/** "1.2.3" → "1.2"; top level → null. */
export function parentNumber(num: string): string | null {
  const i = num.lastIndexOf(".");
  return i === -1 ? null : num.slice(0, i);
}

/** The stored fields for a lesson number. Always write both together. */
export function lessonNumberFields(num: string): { lessonNumber: string; topLevel: number | undefined } {
  return { lessonNumber: num, topLevel: parentNumber(num) === null ? Number(num) : undefined };
}

/** True if `num` is strictly inside `ancestor`'s subtree. */
export function isDescendant(num: string, ancestor: string): boolean {
  return num.startsWith(ancestor + ".");
}
