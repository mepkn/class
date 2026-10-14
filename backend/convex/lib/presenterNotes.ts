// Presenter notes are for the teacher only. Two forms:
//   %% one line            a line starting with `%%` (leading spaces allowed)
//   %%                     a line that is just `%%` opens a note block, and the next one
//   several lines            closes it; a block left open runs to the end of the slide
//   %%
// Lines inside fenced code blocks (``` / ~~~) are never notes, so things like Jupyter's
// `%%timeit` keep working.

const NOTE = /^\s*%%/;
/** A line that opens or closes a note block. `slides.ts` uses it so blocks never split. */
export const NOTE_BLOCK = /^\s*%%\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

function mapLines(markdown: string, onNote: (lines: string[]) => string | null): string {
  const out: string[] = [];
  let fence: string | null = null;
  let block: string[] | null = null;
  const emit = (lines: string[]) => {
    const replaced = onNote(lines);
    if (replaced !== null) out.push(replaced);
  };
  for (const line of markdown.split("\n")) {
    if (block !== null) {
      if (NOTE_BLOCK.test(line)) {
        emit(block);
        block = null;
      } else block.push(line);
      continue;
    }
    const m = FENCE.exec(line);
    if (m) {
      if (fence === null) fence = m[1];
      else if (m[1][0] === fence[0] && m[1].length >= fence.length && m[2].trim() === "") fence = null;
      out.push(line);
      continue;
    }
    if (fence === null && NOTE_BLOCK.test(line)) block = [];
    else if (fence === null && NOTE.test(line)) emit([line.replace(NOTE, "").trim()]);
    else out.push(line);
  }
  if (block !== null) emit(block);
  return out.join("\n");
}

/** What students receive: notes removed. */
export function stripPresenterNotes(markdown: string): string {
  return mapLines(markdown, () => null);
}

/** Teacher preview: each note becomes a visible 📝 callout. */
export function showPresenterNotes(markdown: string): string {
  return mapLines(markdown, (lines) => {
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (lines.length === 0) lines = ["…"];
    lines[0] = `📝 ${lines[0]}`;
    return `\n${lines.map((l) => `> ${l}`.trimEnd()).join("\n")}\n`;
  });
}
