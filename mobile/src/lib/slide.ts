import { parsePollBlocks, type PollBlock } from "@convex/lib/inlinePolls";
import { presenterNoteParts } from "@convex/lib/presenterNotes";
import { splitSlides } from "@convex/lib/slides";

// A ```poll block, up to the closing fence of the same kind.
const POLL_FENCE = /^[ \t]*(`{3,}|~{3,})poll[ \t]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;

export type SlidePart = { kind: "text" | "note"; text: string } | { kind: "poll"; blockIndex: number; block: PollBlock | undefined };

/** The live board's source as slides, each cut into text, the teacher's notes and polls, in order. */
export function lessonSlides(source: string): SlidePart[][] {
  return splitSlides(source).map((part) => {
    // Polls are numbered across the slide, as the board numbers its ```poll blocks.
    const next = { blockIndex: 0 };
    return presenterNoteParts(part).flatMap((p): SlidePart[] => (p.kind === "text" ? withPolls(p.text, next) : [p]));
  });
}

function withPolls(text: string, next: { blockIndex: number }): SlidePart[] {
  const parts: SlidePart[] = [];
  let at = 0;
  const pushText = (t: string) => {
    if (t.trim()) parts.push({ kind: "text", text: t.trim() });
  };
  for (const m of text.matchAll(POLL_FENCE)) {
    pushText(text.slice(at, m.index));
    parts.push({ kind: "poll", blockIndex: next.blockIndex++, block: parsePollBlocks(m[0].trim())[0] });
    at = m.index + m[0].length;
  }
  pushText(text.slice(at));
  return parts;
}
