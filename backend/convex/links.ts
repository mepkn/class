import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireTeacher } from "./lib/requireTeacher";
import { readRoom } from "./lib/room";
import { embedUrl, frameBlocked, linksIn, normalizeLink } from "./lib/links";

const MAX_LINKS = 40;
// Live edits save as the teacher types: wait until the link is finished before checking it.
const LIVE_EDIT_DELAY_MS = 10_000;

/** Links in some Markdown whose site refuses to be shown inside the class page (as checked so far). */
export async function blockedLinksIn(ctx: QueryCtx, markdown: string): Promise<string[]> {
  const blocked: string[] = [];
  for (const { url } of linksIn(markdown).slice(0, MAX_LINKS)) {
    const check = await ctx.db
      .query("linkChecks")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (check && !check.embeddable) blocked.push(url);
  }
  return blocked;
}

async function unchecked(ctx: QueryCtx, urls: string[]) {
  const out: string[] = [];
  for (const url of urls) {
    const check = await ctx.db
      .query("linkChecks")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (!check) out.push(url);
  }
  return out;
}

/**
 * Schedules a check of the links in some Markdown never checked before (results are kept for
 * good; the teacher's ↻ re-checks one). `live`: a live edit, checked once typing has settled.
 */
export async function checkLinksIn(ctx: MutationCtx, markdown: string, { live = false } = {}) {
  const urls = await unchecked(ctx, linksIn(markdown).slice(0, MAX_LINKS).map((l) => l.url));
  if (urls.length === 0) return;
  await ctx.scheduler.runAfter(live ? LIVE_EDIT_DELAY_MS : 0, internal.links.check, { urls, live });
}

/** Of `urls`, the ones still on the live board and still unchecked (half-typed links are gone). */
export const stillToCheck = internalQuery({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, { urls }) => {
    const room = await readRoom(ctx);
    const onBoard = new Set(linksIn(room?.currentContent ?? "").map((l) => l.url));
    return await unchecked(ctx, urls.filter((url) => onBoard.has(url)));
  },
});

/**
 * Fetches the page (the YouTube player for YouTube links) and reads its headers. A page that
 * can't be fetched counts as not embeddable: a new tab is the safer fallback. (Google's pages,
 * Gemini among them, send more headers than fetch accepts; they refuse to be embedded anyway.)
 */
async function embeddable(url: string): Promise<boolean> {
  try {
    const res = await fetch(embedUrl(url), { redirect: "follow", signal: AbortSignal.timeout(8000) });
    await res.body?.cancel();
    return !frameBlocked(res.headers);
  } catch {
    return false;
  }
}

export const check = internalAction({
  args: { urls: v.array(v.string()), live: v.optional(v.boolean()) },
  handler: async (ctx, { urls, live }) => {
    if (live) urls = await ctx.runQuery(internal.links.stillToCheck, { urls });
    await Promise.all(
      urls.map(async (url) => {
        await ctx.runMutation(internal.links.record, { url, embeddable: await embeddable(url) });
      }),
    );
  },
});

export const record = internalMutation({
  args: { url: v.string(), embeddable: v.boolean() },
  handler: async (ctx, { url, embeddable }) => {
    const existing = await ctx.db
      .query("linkChecks")
      .withIndex("by_url", (q) => q.eq("url", url))
      .first();
    if (existing) await ctx.db.patch(existing._id, { embeddable, checkedAt: Date.now() });
    else await ctx.db.insert("linkChecks", { url, embeddable, checkedAt: Date.now() });
  },
});

export const assertTeacher = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireTeacher(ctx);
  },
});

/** Teacher only: checks a link now (a pasted one, or ↻ on a cached result). True if it can be shown in the panel. */
export const checkLink = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<boolean> => {
    await ctx.runQuery(internal.links.assertTeacher, {});
    const link = normalizeLink(url);
    if (!link) throw new ConvexError("That isn't a web address (http or https)");
    const ok = await embeddable(link);
    await ctx.runMutation(internal.links.record, { url: link, embeddable: ok });
    return ok;
  },
});
