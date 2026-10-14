// Inline polls: a ```poll fence in a lesson's Markdown.
//
//   ```poll
//   What is $F$ if $m = 2$ and $a = 3$?
//   - 5
//   - [x] 6
//   ```
//
// Lines before the first `- ` option are the question (Markdown). `- [x]` marks the correct
// option; with none marked it is an opinion poll. Blocks are numbered per slide in order,
// invalid ones included, so a typo in one block doesn't shift the others.

import { checkPoll, type PollInput } from "./pollRules";
import { splitSlides } from "./slides";

export type PollBlock = { poll: PollInput } | { error: string };

const FENCE = /^\s*(`{3,}|~{3,})\s*(\S*)/;
const OPTION = /^\s*[-*]\s+(?:\[( |x|X)\]\s*)?(.*)$/;

/** Every ```poll block in `markdown`, in order. Polls inside other code fences are ignored. */
export function parsePollBlocks(markdown: string): PollBlock[] {
  const blocks: PollBlock[] = [];
  let fence: string | null = null;
  let body: string[] | null = null; // set while inside a ```poll fence
  for (const line of markdown.split("\n")) {
    const m = FENCE.exec(line);
    if (fence === null) {
      if (m) {
        fence = m[1];
        if (m[2] === "poll") body = [];
      }
    } else if (m && m[1][0] === fence[0] && m[1].length >= fence.length && m[2] === "") {
      if (body) blocks.push(parseBody(body));
      fence = null;
      body = null;
    } else if (body) {
      body.push(line);
    }
  }
  if (body) blocks.push({ error: "Poll block is missing its closing ```" });
  return blocks;
}

function parseBody(lines: string[]): PollBlock {
  const question: string[] = [];
  const options: string[] = [];
  const correct: number[] = [];
  for (const line of lines) {
    const m = OPTION.exec(line);
    if (m && (options.length > 0 || question.some((q) => q.trim() !== ""))) {
      if (m[1]?.toLowerCase() === "x") correct.push(options.length);
      options.push(m[2]);
    } else if (options.length === 0) {
      question.push(line);
    } else if (line.trim() !== "") {
      return { error: "Only options (- …) can follow the first option" };
    }
  }
  if (correct.length > 1) return { error: "Mark at most one correct option with [x]" };
  return checkPoll({ question: question.join("\n"), options, correctIndex: correct[0] });
}

export type ContentPoll = PollBlock & { slide: number; blockIndex: number };

/** Every poll block in a lesson, with the slide it's on (0-based) and its index on that slide. */
export function pollsInContent(markdown: string): ContentPoll[] {
  return splitSlides(markdown).flatMap((slide, slideIndex) =>
    parsePollBlocks(slide).map((block, blockIndex) => ({ ...block, slide: slideIndex, blockIndex })),
  );
}
