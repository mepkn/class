import { presenterNoteParts } from "@convex/lib/presenterNotes";
import { splitSlides } from "@convex/lib/slides";

// A ```poll block, up to the closing fence of the same kind. The remote runs polls from
// the Polls tab, so the preview shows a marker instead of the block's source.
const POLL_FENCE = /^[ \t]*(`{3,}|~{3,})poll[ \t]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
export const POLL_MARKER = "> 📊 Poll on this slide · run it from the Polls tab";

export type SlidePart = { kind: "text" | "note"; text: string };

/** The live board's source as slides, each cut into text and the teacher's notes, in order. */
export function lessonSlides(source: string): SlidePart[][] {
  return splitSlides(source).map((part) =>
    presenterNoteParts(part).map((p) => (p.kind === "text" ? { ...p, text: p.text.replace(POLL_FENCE, POLL_MARKER) } : p)),
  );
}
