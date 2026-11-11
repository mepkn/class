import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cleanCopyText } from "@/lib/cleanCopyText";

describe("cleanCopyText", () => {
  it("strips ++ underline syntax from copied text", () => {
    const raw = '++You are a strict teacher++. Check my answer: "The Sun goes around the Earth." Point out every mistake.';
    expect(cleanCopyText(raw)).toBe(
      'You are a strict teacher. Check my answer: "The Sun goes around the Earth." Point out every mistake.'
    );
  });

  it("strips presenter notes (%% lines)", () => {
    const raw = "%% secret teacher note\nGive me 5 names for our school cricket team.";
    expect(cleanCopyText(raw)).toBe("Give me 5 names for our school cricket team.");
  });

  it("strips <u> tags", () => {
    const raw = "Explain <u>step by step</u>, simply.";
    expect(cleanCopyText(raw)).toBe("Explain step by step, simply.");
  });
});

describe("MarkdownRenderer copy block (```copy)", () => {
  it("renders a copy card with a Copy button", () => {
    const md = '```copy\nCheck my answer: "The Sun goes around the Earth."\n```';
    const html = renderToStaticMarkup(<MarkdownRenderer content={md} />);
    expect(html).toContain("Copy");
    expect(html).toContain('Check my answer: &quot;The Sun goes around the Earth.&quot;');
  });

  it("renders underlined text inside copy card with <ins>", () => {
    const md = '```copy\n++You are a strict teacher++. Check my answer.\n```';
    const html = renderToStaticMarkup(<MarkdownRenderer content={md} />);
    expect(html).toContain('<ins class="md-underline">You are a strict teacher</ins>');
  });

  it("supports aliases like ```prompt and ```clip", () => {
    const md = '```prompt\nPlan a birthday party.\n```';
    const html = renderToStaticMarkup(<MarkdownRenderer content={md} />);
    expect(html).toContain("Copy");
    expect(html).toContain("Plan a birthday party.");
  });
});

describe("MarkdownRenderer underline syntax", () => {
  it("renders ++text++ as an underlined <ins> element", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="This is ++important++ concept" />);
    expect(html).toContain('<ins class="md-underline">important</ins>');
  });

  it("renders multiple words inside ++...++", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="Here is ++a whole phrase++ underlined" />);
    expect(html).toContain('<ins class="md-underline">a whole phrase</ins>');
  });

  it("handles bold inside underline (++**bold**++)", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="++**bold underlined text**++" />);
    expect(html).toContain('<ins class="md-underline"><strong>bold underlined text</strong></ins>');
  });

  it("handles underline inside bold (**++bold underline++**)", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="**++bold underlined text++**" />);
    expect(html).toContain('<strong><ins class="md-underline">bold underlined text</ins></strong>');
  });

  it("handles underline inside italics (*++italic underline++*)", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="*++italic underlined text++*" />);
    expect(html).toContain('<em><ins class="md-underline">italic underlined text</ins></em>');
  });

  it("does not underline inside inline code", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="Inline `++not underlined++` code" />);
    expect(html).toContain("<code>++not underlined++</code>");
    expect(html).not.toContain("<ins");
  });

  it("does not underline inside code blocks", () => {
    const md = "```python\nx = ++y\n```";
    const html = renderToStaticMarkup(<MarkdownRenderer content={md} />);
    expect(html).not.toContain("<ins");
    expect(html).toContain("++y");
  });

  it("leaves C++ and non-paired ++ untouched", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="C++ and C++20 are languages" />);
    expect(html).not.toContain("<ins");
    expect(html).toContain("C++ and C++20 are languages");
  });

  it("applies md-underline-curly class when underlineStyle='curly'", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="++hello++" underlineStyle="curly" />);
    expect(html).toContain("md-underline-curly");
  });

  it("defaults to standard underline without md-underline-curly class", () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="++hello++" />);
    expect(html).not.toContain("md-underline-curly");
  });
});
