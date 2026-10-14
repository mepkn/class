/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  process.env.ALLOWED_EMAILS = "teacher@school.edu";
});

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "teacher@school.edu" }));
  const teacher = t.withIdentity({ subject: `${userId}|session` });
  const lessonId = await t.run((ctx) =>
    ctx.db.insert("lessons", { lessonNumber: "1", title: "L", content: "a\n\n---\n\nb", isLocked: false, isHidden: false }),
  );
  await teacher.mutation(api.classroom.pushLesson, { lessonId });
  return { t, teacher, lessonId };
}

describe("links shown to the class", () => {
  it("only the teacher can open one, and only http(s)", async () => {
    const { t, teacher } = await setup();
    await expect(t.mutation(api.classroom.showLink, { url: "https://x.org" })).rejects.toThrow("Not authenticated");
    await expect(teacher.mutation(api.classroom.showLink, { url: "javascript:alert(1)" })).rejects.toThrow(
      "web address",
    );
    await teacher.mutation(api.classroom.showLink, { url: "docs.python.org" });
    expect((await t.query(api.classroom.getActiveSession, {})).link).toBe("https://docs.python.org/");
  });

  it("Back to board closes it and tells students to close their own", async () => {
    const { t, teacher } = await setup();
    await teacher.mutation(api.classroom.showLink, { url: "https://x.org" });
    await teacher.mutation(api.classroom.closeLinks, {});
    const session = await t.query(api.classroom.getActiveSession, {});
    expect(session.link).toBeNull();
    expect(session.linksClosedAt).toBeTypeOf("number");
  });

  it("tells students which board links refuse the panel", async () => {
    const { t, teacher } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("linkChecks", { url: "https://blocked.org/", embeddable: false, checkedAt: Date.now() });
      await ctx.db.insert("linkChecks", { url: "https://fine.org/", embeddable: true, checkedAt: Date.now() });
    });
    await teacher.mutation(api.classroom.updateLiveContent, {
      content: "[A](https://blocked.org) [B](https://fine.org) [C](https://unknown.org)",
    });
    expect((await t.query(api.classroom.getActiveSession, {})).blockedLinks).toEqual(["https://blocked.org/"]);
  });

  it("live edits only check finished links still on the board", async () => {
    const { t, teacher } = await setup();
    await teacher.mutation(api.classroom.updateLiveContent, { content: "[A](https://done.org) [B](https://seen.org)" });
    await t.run((ctx) =>
      ctx.db.insert("linkChecks", { url: "https://seen.org/", embeddable: true, checkedAt: Date.now() }),
    );
    const urls = ["https://don.or/", "https://done.org/", "https://seen.org/"];
    expect(await t.query(internal.links.stillToCheck, { urls })).toEqual(["https://done.org/"]);
  });

  it("closes when the board moves on: next slide, push, blank board, a poll", async () => {
    const { t, teacher, lessonId } = await setup();
    const linkAfter = async (move: () => Promise<unknown>) => {
      await teacher.mutation(api.classroom.showLink, { url: "https://x.org" });
      await move();
      return (await t.query(api.classroom.getActiveSession, {})).link;
    };
    expect(await linkAfter(() => teacher.mutation(api.classroom.setSlide, { index: 1 }))).toBeNull();
    expect(await linkAfter(() => teacher.mutation(api.classroom.pushLesson, { lessonId }))).toBeNull();
    expect(await linkAfter(() => teacher.mutation(api.classroom.pushBlankBoard, {}))).toBeNull();
    expect(
      await linkAfter(() => teacher.mutation(api.polls.launchNew, { question: "Q", options: ["a", "b"] })),
    ).toBeNull();
    // Live edits while it's open don't close it.
    expect(await linkAfter(() => teacher.mutation(api.classroom.updateLiveContent, { content: "x" }))).toBe(
      "https://x.org/",
    );
  });
});
