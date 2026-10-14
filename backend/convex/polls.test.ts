/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TOKEN = "voter-token-1";

beforeEach(() => {
  process.env.ALLOWED_EMAILS = "teacher@school.edu";
});

/** A test backend plus a signed-in teacher. */
async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "teacher@school.edu" }));
  const teacher = t.withIdentity({ subject: `${userId}|session` });
  return { t, teacher };
}

const quiz = { question: "2 + 2?", options: ["3", "4"], correctIndex: 1 };

describe("saved polls", () => {
  it("refuses anyone who isn't a teacher", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.polls.createPoll, quiz)).rejects.toThrow("Not authenticated");
  });

  it("validates with the shared rules (2–6 options)", async () => {
    const { teacher } = await setup();
    const options = ["a", "b", "c", "d", "e", "f"];
    await expect(teacher.mutation(api.polls.createPoll, { question: "Q", options })).resolves.toBeDefined();
    await expect(
      teacher.mutation(api.polls.createPoll, { question: "Q", options: [...options, "g"] }),
    ).rejects.toThrow("A poll needs 2–6 options");
  });

  it("adds lesson polls to the lesson's list in order", async () => {
    const { t, teacher } = await setup();
    const lessonId = await t.run((ctx) =>
      ctx.db.insert("lessons", { lessonNumber: "1", title: "L", content: "", isLocked: false, isHidden: false }),
    );
    const a = await teacher.mutation(api.polls.createPoll, { ...quiz, lessonId });
    const b = await teacher.mutation(api.polls.createPoll, { ...quiz, question: "Other?", lessonId });
    const links = await t.run((ctx) => ctx.db.query("lessonPolls").collect());
    expect(links.map((l) => [l.pollId, l.order])).toEqual([[a, 0], [b, 1]]);
  });

  it("turns a quiz into an opinion poll, but not while it's on screen", async () => {
    const { t, teacher } = await setup();
    const pollId = await teacher.mutation(api.polls.createPoll, quiz);
    await teacher.mutation(api.polls.launchSaved, { pollId });
    await expect(teacher.mutation(api.polls.updatePoll, { pollId, question: "Q", options: ["a", "b"] })).rejects.toThrow(
      "Close this poll",
    );
    await teacher.mutation(api.polls.closeSaved, {});
    await teacher.mutation(api.polls.updatePoll, { pollId, question: "Q", options: ["a", "b"] });
    const poll = await t.run((ctx) => ctx.db.get(pollId));
    expect(poll?.correctIndex).toBeUndefined();
  });
});

describe("running a saved poll", () => {
  it("hides results and the answer until revealed, then closes voting", async () => {
    const { t, teacher } = await setup();
    const runId = await teacher.mutation(api.polls.launchNew, quiz);
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 1 });
    await expect(t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 0 })).rejects.toThrow(
      "already voted",
    );

    let session = await t.query(api.classroom.getActiveSession, {});
    expect(session.mode).toBe("poll");
    expect(session.poll?.results).toBeNull();
    expect(JSON.stringify(session)).not.toContain("correctIndex");

    await teacher.mutation(api.polls.revealRun, { runId });
    session = await t.query(api.classroom.getActiveSession, {});
    expect(session.poll?.results).toEqual({ correctIndex: 1, numbers: "percent", counts: [0, 1], total: 1 });

    await teacher.mutation(api.classroom.setPollNumbers, { numbers: "count" });
    session = await t.query(api.classroom.getActiveSession, {});
    expect(session.poll?.results?.numbers).toBe("count");
    await expect(
      t.mutation(api.polls.submitVote, { runId, voterToken: "voter-token-2", selectedOption: 0 }),
    ).rejects.toThrow();
  });

  it("shows no answer for an opinion poll", async () => {
    const { t, teacher } = await setup();
    const runId = await teacher.mutation(api.polls.launchNew, { question: "Tea?", options: ["Yes", "No"] });
    await teacher.mutation(api.polls.revealRun, { runId });
    const session = await t.query(api.classroom.getActiveSession, {});
    expect(session.poll?.results?.correctIndex).toBeNull();
  });

  it("saves a poll launched on the spot to the bank", async () => {
    const { t, teacher } = await setup();
    await teacher.mutation(api.polls.launchNew, quiz);
    const polls = await t.run((ctx) => ctx.db.query("polls").collect());
    expect(polls).toHaveLength(1);
    expect(polls[0].ownerLessonId).toBeUndefined();
  });

  it("deletes the run and its votes on close, keeping the poll", async () => {
    const { t, teacher } = await setup();
    const runId = await teacher.mutation(api.polls.launchNew, quiz);
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 0 });
    await teacher.mutation(api.polls.closeSaved, {});
    const left = await t.run(async (ctx) => ({
      runs: await ctx.db.query("pollRuns").collect(),
      votes: await ctx.db.query("votes").collect(),
      polls: await ctx.db.query("polls").collect(),
      room: await ctx.db.query("classroomState").first(),
    }));
    expect(left.runs).toEqual([]);
    expect(left.votes).toEqual([]);
    expect(left.polls).toHaveLength(1);
    expect(left.room?.mode).toBe("lesson");
  });

  it("starts fresh on Blank Blackboard", async () => {
    const { t, teacher } = await setup();
    const runId = await teacher.mutation(api.polls.launchNew, quiz);
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 0 });
    await teacher.mutation(api.classroom.pushBlankBoard, {});
    const left = await t.run(async (ctx) => [
      ...(await ctx.db.query("pollRuns").collect()),
      ...(await ctx.db.query("votes").collect()),
    ]);
    expect(left).toEqual([]);
  });
});

describe("inline polls", () => {
  const poll = (q: string) => "```poll\n" + q + "\n- a\n- [x] b\n```";
  const content = ["# Intro", "", "---", "", "Quick check:", poll("First?"), "", "---", "", "# After"].join("\n");

  async function pushed() {
    const { t, teacher } = await setup();
    const lessonId = await t.run((ctx) =>
      ctx.db.insert("lessons", { lessonNumber: "1", title: "L", content, isLocked: false, isHidden: false }),
    );
    await teacher.mutation(api.classroom.pushLesson, { lessonId });
    const runs = () => t.run((ctx) => ctx.db.query("pollRuns").collect());
    const session = () => t.query(api.classroom.getActiveSession, {});
    return { t, teacher, lessonId, runs, session };
  }

  it("starts when its slide is reached and shows under that slide", async () => {
    const { teacher, runs, session } = await pushed();
    expect(await runs()).toEqual([]);
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [run] = await runs();
    expect(run).toMatchObject({ kind: "inline", slide: 1, blockIndex: 0, open: true, revealed: false });
    const s = await session();
    expect(s.revealed.map((p) => p.slide)).toEqual([0, 1]);
    expect(s.inlinePolls).toMatchObject([{ slide: 1, blockIndex: 0, question: "First?", results: null }]);
    expect(JSON.stringify(s.inlinePolls)).not.toContain("correctIndex");
  });

  it("reveals when you move on and keeps the results in build mode", async () => {
    const { t, teacher, runs, session } = await pushed();
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [{ _id: runId }] = await runs();
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 1 });
    await teacher.mutation(api.classroom.setSlide, { index: 2 });
    const s = await session();
    expect(s.inlinePolls[0].results).toEqual({ correctIndex: 1, numbers: "percent", counts: [0, 1], total: 1 });
    await expect(
      t.mutation(api.polls.submitVote, { runId, voterToken: "voter-token-2", selectedOption: 0 }),
    ).rejects.toThrow();
  });

  it("keeps results when you go back; Run again starts over", async () => {
    const { t, teacher, runs } = await pushed();
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [{ _id: runId }] = await runs();
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 1 });
    await teacher.mutation(api.classroom.setSlide, { index: 2 });
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [back] = await runs();
    expect(back).toMatchObject({ _id: runId, open: false, revealed: true });

    await teacher.mutation(api.polls.rerunInline, { blockIndex: 0 });
    const [again] = await runs();
    expect(again._id).not.toBe(runId);
    expect(again).toMatchObject({ open: true, revealed: false });
    expect(await t.run((ctx) => ctx.db.query("votes").collect())).toEqual([]);
  });

  it("hides past polls in replace mode", async () => {
    const { teacher, session } = await pushed();
    await teacher.mutation(api.classroom.setSlideMode, { mode: "replace" });
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    await teacher.mutation(api.classroom.setSlide, { index: 2 });
    expect((await session()).inlinePolls).toEqual([]);
  });

  it("starts fresh when the lesson is pushed again", async () => {
    const { t, teacher, lessonId, runs } = await pushed();
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [{ _id: runId }] = await runs();
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 0 });
    await teacher.mutation(api.classroom.pushBlankBoard, {});
    await teacher.mutation(api.classroom.pushLesson, { lessonId });
    expect(await runs()).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("votes").collect())).toEqual([]);
  });

  it("restarts a poll edited live and leaves the others alone", async () => {
    const { teacher, runs } = await pushed();
    await teacher.mutation(api.classroom.setSlide, { index: 1 });
    const [before] = await runs();
    await teacher.mutation(api.classroom.updateLiveContent, { content: content + "\n" });
    expect((await runs())[0]._id).toBe(before._id);
    await teacher.mutation(api.classroom.updateLiveContent, { content: content.replace("First?", "Edited?") });
    const [after] = await runs();
    expect(after._id).not.toBe(before._id);
    expect(after.question).toBe("Edited?");
  });

  it("starts a poll on the first slide when the lesson is pushed", async () => {
    const { t, teacher } = await setup();
    const lessonId = await t.run((ctx) =>
      ctx.db.insert("lessons", { lessonNumber: "1", title: "L", content: poll("Now?"), isLocked: false, isHidden: false }),
    );
    await teacher.mutation(api.classroom.pushLesson, { lessonId });
    expect(await t.run((ctx) => ctx.db.query("pollRuns").collect())).toHaveLength(1);
  });
});

describe("lesson poll lists and the bank", () => {
  async function withLessons() {
    const { t, teacher } = await setup();
    const lesson = (n: string, content = "") =>
      t.run((ctx) => ctx.db.insert("lessons", { lessonNumber: n, title: n, content, isLocked: false, isHidden: false }));
    return { t, teacher, a: await lesson("1", "```poll\nInline?\n- x\n- y\n```"), b: await lesson("2") };
  }

  it("links a bank poll to several lessons without copying it", async () => {
    const { t, teacher, a, b } = await withLessons();
    const pollId = await teacher.mutation(api.polls.createPoll, quiz);
    await teacher.mutation(api.polls.linkPoll, { lessonId: a, pollId });
    await teacher.mutation(api.polls.linkPoll, { lessonId: b, pollId });
    await expect(teacher.mutation(api.polls.linkPoll, { lessonId: a, pollId })).rejects.toThrow("already");
    await teacher.mutation(api.polls.updatePoll, { pollId, question: "Edited?", options: ["a", "b"] });
    const listB = await teacher.query(api.polls.listLessonPolls, { lessonId: b });
    expect(listB?.saved.map((p) => [p.question, p.inBank])).toEqual([["Edited?", true]]);
    expect(await t.run((ctx) => ctx.db.query("polls").collect())).toHaveLength(1);
    const [bank] = await teacher.query(api.polls.searchBank, {});
    expect(bank.lessonCount).toBe(2);
  });

  it("lists inline polls read-only next to saved ones", async () => {
    const { teacher, a } = await withLessons();
    await teacher.mutation(api.polls.createPoll, { ...quiz, lessonId: a });
    const list = await teacher.query(api.polls.listLessonPolls, { lessonId: a });
    expect(list?.saved.map((p) => p.inBank)).toEqual([false]);
    expect(list?.inline).toMatchObject([{ slide: 0, blockIndex: 0, poll: { question: "Inline?" } }]);
  });

  it("keeps lesson polls out of the bank and other lessons", async () => {
    const { teacher, a, b } = await withLessons();
    const pollId = await teacher.mutation(api.polls.createPoll, { ...quiz, lessonId: a });
    expect(await teacher.query(api.polls.searchBank, {})).toEqual([]);
    await expect(teacher.mutation(api.polls.linkPoll, { lessonId: b, pollId })).rejects.toThrow("Only bank polls");
  });

  it("unlinks a bank poll but keeps it, and reorders", async () => {
    const { teacher, a } = await withLessons();
    const own = await teacher.mutation(api.polls.createPoll, { ...quiz, lessonId: a });
    const bankPoll = await teacher.mutation(api.polls.createPoll, { ...quiz, question: "Bank?" });
    await teacher.mutation(api.polls.linkPoll, { lessonId: a, pollId: bankPoll });
    let list = (await teacher.query(api.polls.listLessonPolls, { lessonId: a }))!;
    expect(list.saved.map((p) => p._id)).toEqual([own, bankPoll]);
    await teacher.mutation(api.polls.movePoll, { linkId: list.saved[1].linkId, direction: "up" });
    list = (await teacher.query(api.polls.listLessonPolls, { lessonId: a }))!;
    expect(list.saved.map((p) => p._id)).toEqual([bankPoll, own]);
    await expect(teacher.mutation(api.polls.unlinkPoll, { linkId: list.saved[1].linkId })).rejects.toThrow();
    await teacher.mutation(api.polls.unlinkPoll, { linkId: list.saved[0].linkId });
    expect(await teacher.query(api.polls.searchBank, {})).toHaveLength(1);
  });
});

describe("deleting a lesson", () => {
  it("deletes its own polls, unlinks bank polls, and says how many", async () => {
    const { t, teacher } = await setup();
    const lessonId = await t.run((ctx) =>
      ctx.db.insert("lessons", {
        lessonNumber: "9",
        title: "L",
        content: "```poll\nQ?\n- a\n- b\n```",
        isLocked: false,
        isHidden: false,
      }),
    );
    await teacher.mutation(api.polls.createPoll, { ...quiz, lessonId });
    const bankPoll = await teacher.mutation(api.polls.createPoll, { ...quiz, question: "Bank?" });
    await teacher.mutation(api.polls.linkPoll, { lessonId, pollId: bankPoll });

    expect(await teacher.query(api.classroom.lessonPollCount, { lessonId })).toEqual({ deleted: 2, bankLinked: 1 });
    await teacher.mutation(api.classroom.deleteLesson, { lessonId });
    const left = await t.run(async (ctx) => ({
      polls: (await ctx.db.query("polls").collect()).map((p) => p._id),
      links: await ctx.db.query("lessonPolls").collect(),
    }));
    expect(left).toEqual({ polls: [bankPoll], links: [] });
  });
});

describe("pause", () => {
  it("freezes voting until resumed, and keeps the poll", async () => {
    const { t, teacher } = await setup();
    const pollId = await teacher.mutation(api.polls.createPoll, quiz);
    const runId = await teacher.mutation(api.polls.launchSaved, { pollId });
    await teacher.mutation(api.classroom.setPaused, { paused: true });

    const session = await t.query(api.classroom.getActiveSession, {});
    expect(session.paused).toBe(true);
    expect(session.poll?._id).toBe(runId);
    await expect(t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 1 })).rejects.toThrow(
      "Voting is paused",
    );

    await teacher.mutation(api.classroom.setPaused, { paused: false });
    await t.mutation(api.polls.submitVote, { runId, voterToken: TOKEN, selectedOption: 1 });
  });

  it("ends with a push or a new poll", async () => {
    const { t, teacher } = await setup();
    await teacher.mutation(api.classroom.setPaused, { paused: true });
    await teacher.mutation(api.classroom.pushBlankBoard, {});
    expect((await t.query(api.classroom.getActiveSession, {})).paused).toBe(false);

    await teacher.mutation(api.classroom.setPaused, { paused: true });
    await teacher.mutation(api.polls.launchSaved, { pollId: await teacher.mutation(api.polls.createPoll, quiz) });
    expect((await t.query(api.classroom.getActiveSession, {})).paused).toBe(false);
  });
});
