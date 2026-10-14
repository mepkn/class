import { describe, expect, it } from "vitest";
import { embedUrl, frameBlocked, linksIn, normalizeLink } from "./links";

describe("normalizeLink", () => {
  it("accepts http(s) and adds https:// when missing", () => {
    expect(normalizeLink(" https://docs.python.org ")).toBe("https://docs.python.org/");
    expect(normalizeLink("docs.python.org/3/")).toBe("https://docs.python.org/3/");
  });
  it("refuses other schemes and non-addresses", () => {
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("file:///etc/passwd")).toBeNull();
    expect(normalizeLink("hello")).toBeNull();
    expect(normalizeLink("")).toBeNull();
  });
});

describe("embedUrl", () => {
  it("turns YouTube pages into the embed player", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42",
    );
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("leaves other links alone", () => {
    expect(embedUrl("https://en.wikipedia.org/wiki/Python")).toBe("https://en.wikipedia.org/wiki/Python");
  });
});

describe("linksIn", () => {
  it("finds Markdown, angle and bare links once each, in order", () => {
    const md = "See [Python docs](https://docs.python.org) and <https://example.com/a>.\nAlso https://docs.python.org, https://x.org/b).";
    expect(linksIn(md)).toEqual([
      { url: "https://docs.python.org/", text: "Python docs" },
      { url: "https://example.com/a", text: "example.com" },
      { url: "https://x.org/b", text: "x.org" },
    ]);
  });
  it("skips images", () => {
    expect(linksIn("![GPU](https://img.example.com/gpu.jpg) [Go](https://go.dev)")).toEqual([
      { url: "https://go.dev/", text: "Go" },
    ]);
  });
});

describe("frameBlocked", () => {
  const blocked = (h: Record<string, string>) => frameBlocked(new Headers(h));
  it("is blocked by X-Frame-Options or a strict frame-ancestors", () => {
    expect(blocked({ "x-frame-options": "SAMEORIGIN" })).toBe(true);
    expect(blocked({ "x-frame-options": "DENY" })).toBe(true);
    expect(blocked({ "content-security-policy": "default-src 'self'; frame-ancestors 'self' https://google.com" })).toBe(true);
    expect(blocked({ "content-security-policy": "frame-ancestors 'none'" })).toBe(true);
  });
  it("is allowed without them, or when anyone may embed", () => {
    expect(blocked({})).toBe(false);
    expect(blocked({ "content-security-policy": "default-src 'self'" })).toBe(false);
    expect(blocked({ "content-security-policy": "frame-ancestors *" })).toBe(false);
  });
});
