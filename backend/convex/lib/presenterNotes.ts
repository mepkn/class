// Presenter notes: any line starting with `%%` (leading spaces allowed) is a note for
// the teacher only. Lines inside fenced code blocks (``` / ~~~) are never notes, so
// things like Jupyter's `%%timeit` keep working.

const NOTE = /^\s*%%/;
const FENCE = /^\s*(```|~~~)/;

function mapLines(markdown: string, onNote: (line: string) => string | null): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const f = FENCE.exec(line)?.[1];
    if (f) {
      if (fence === null) fence = f;
      else if (fence === f) fence = null;
      out.push(line);
      continue;
    }
    if (fence === null && NOTE.test(line)) {
      const replaced = onNote(line.replace(NOTE, "").trim());
      if (replaced !== null) out.push(replaced);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** What students receive: notes removed. */
export function stripPresenterNotes(markdown: string): string {
  return mapLines(markdown, () => null);
}

/** Teacher preview: each note becomes a visible callout. */
export function showPresenterNotes(markdown: string): string {
  return mapLines(markdown, (text) => `\n> 📝 **Note:** ${text || "…"}\n`);
}
