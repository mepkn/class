// Slides: a lesson is split into slides on a line that is exactly `---`, preceded by a
// blank line (or the start). The blank-line rule keeps Markdown's "Heading\n---" (a setext
// heading) working. Lines inside fenced code blocks (``` / ~~~) never split.

const SEPARATOR = /^---\s*$/;
const FENCE = /^\s*(```|~~~)/;

export function splitSlides(markdown: string): string[] {
  const slides: string[][] = [[]];
  let fence: string | null = null;
  let prevBlank = true;
  for (const line of markdown.split("\n")) {
    const f = FENCE.exec(line)?.[1];
    if (f) {
      if (fence === null) fence = f;
      else if (fence === f) fence = null;
    } else if (fence === null && SEPARATOR.test(line) && prevBlank) {
      slides.push([]);
      prevBlank = true;
      continue;
    }
    slides[slides.length - 1].push(line);
    prevBlank = line.trim() === "";
  }
  const out = slides.map((s) => s.join("\n").trim());
  // A leading `---` shouldn't create an empty first slide.
  if (out.length > 1 && out[0] === "") out.shift();
  return out;
}

/** Clamps a slide index into range for `count` slides. */
export function clampSlide(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, count - 1));
}
