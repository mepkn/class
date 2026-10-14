export const MAX_LINK_CHARS = 2000;

/** A web address students may be shown (http or https only), cleaned up; null if it isn't one. */
export function normalizeLink(input: string): string | null {
  let text = input.trim();
  if (!text || text.length > MAX_LINK_CHARS) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * The address to load in the in-page panel. YouTube's normal pages refuse to be embedded,
 * so watch / short / youtu.be links become the embed player.
 */
export function embedUrl(link: string): string {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" && url.pathname === "/watch") id = url.searchParams.get("v");
    else if (host === "youtube.com" && /^\/(shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2];
    if (id && /^[\w-]{6,}$/.test(id)) {
      const start = url.searchParams.get("t") ?? url.searchParams.get("start");
      const seconds = start ? parseInt(start, 10) : NaN;
      return `https://www.youtube-nocookie.com/embed/${id}${seconds > 0 ? `?start=${seconds}` : ""}`;
    }
  } catch {
    /* not a URL: load as is */
  }
  return link;
}

/** The distinct http(s) links in some Markdown, in order: `[text](url)`, `<url>` and bare URLs (not images). */
export function linksIn(markdown: string): { text: string; url: string }[] {
  const found = new Map<string, string>();
  const add = (url: string, text: string) => {
    const link = normalizeLink(url);
    if (link && !found.has(link)) found.set(link, text.trim() || new URL(link).hostname);
  };
  // Images (`![alt](url)`) aren't links: drop them first.
  const text = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const markdownLink = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)[^)]*\)/g;
  for (const m of text.matchAll(markdownLink)) add(m[2], m[1]);
  const rest = text.replace(markdownLink, " ");
  for (const m of rest.matchAll(/https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/g)) add(m[0], "");
  return [...found].map(([url, text]) => ({ url, text }));
}

/**
 * True when a page's response headers forbid showing it inside another site's page
 * (`X-Frame-Options`, or a CSP `frame-ancestors` that doesn't allow everyone).
 */
export function frameBlocked(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.trim().toLowerCase();
  if (xfo && xfo !== "allowall") return true;
  for (const policy of (headers.get("content-security-policy") ?? "").split(",")) {
    for (const directive of policy.split(";")) {
      const [name, ...sources] = directive.trim().toLowerCase().split(/\s+/);
      if (name === "frame-ancestors" && !sources.some((s) => s === "*" || s === "https:")) return true;
    }
  }
  return false;
}
