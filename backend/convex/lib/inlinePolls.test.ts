import { describe, expect, it } from "vitest";
import { parsePollBlocks, pollsInContent } from "./inlinePolls";
import { checkPoll } from "./pollRules";

const poll = (body: string) => "```poll\n" + body + "\n```";

describe("parsePollBlocks", () => {
  it("reads a quiz poll", () => {
    expect(parsePollBlocks(poll("What is 2 + 2?\n- 3\n- [x] 4\n- 5"))).toEqual([
      { poll: { question: "What is 2 + 2?", options: ["3", "4", "5"], correctIndex: 1 } },
    ]);
  });
  it("reads an opinion poll when nothing is marked", () => {
    expect(parsePollBlocks(poll("Tea or coffee?\n- [ ] Tea\n- Coffee"))).toEqual([
      { poll: { question: "Tea or coffee?", options: ["Tea", "Coffee"] } },
    ]);
  });
  it("keeps math and code in a multi-line question", () => {
    const [block] = parsePollBlocks(poll("Solve $x^2 = 4$:\n\n`x > 0`\n- 2\n- [X] -2"));
    expect(block).toEqual({
      poll: { question: "Solve $x^2 = 4$:\n\n`x > 0`", options: ["2", "-2"], correctIndex: 1 },
    });
  });
  it("allows 2 to 6 options", () => {
    const opts = (n: number) => Array.from({ length: n }, (_, i) => `- o${i}`).join("\n");
    expect(parsePollBlocks(poll("Q\n" + opts(2)))[0]).toHaveProperty("poll");
    expect(parsePollBlocks(poll("Q\n" + opts(6)))[0]).toHaveProperty("poll");
    expect(parsePollBlocks(poll("Q\n" + opts(1)))[0]).toEqual({ error: "A poll needs 2–6 options" });
    expect(parsePollBlocks(poll("Q\n" + opts(7)))[0]).toEqual({ error: "A poll needs 2–6 options" });
  });
  it("rejects two correct options", () => {
    expect(parsePollBlocks(poll("Q\n- [x] a\n- [x] b"))[0]).toHaveProperty("error");
  });
  it("rejects text after the options", () => {
    expect(parsePollBlocks(poll("Q\n- a\n- b\nmore"))[0]).toHaveProperty("error");
  });
  it("rejects a missing question", () => {
    expect(parsePollBlocks(poll("- a\n- b"))[0]).toHaveProperty("error");
  });
  it("ignores poll fences inside other code blocks", () => {
    expect(parsePollBlocks("````md\n" + poll("Q\n- a\n- b") + "\n````")).toEqual([]);
    expect(parsePollBlocks("~~~\n" + poll("Q\n- a\n- b") + "\n~~~")).toEqual([]);
  });
  it("numbers invalid blocks too and reports an unclosed one", () => {
    const md = poll("Q\n- a") + "\n\n" + poll("Q\n- a\n- b") + "\n\n```poll\nQ";
    const blocks = parsePollBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toHaveProperty("error");
    expect(blocks[1]).toHaveProperty("poll");
    expect(blocks[2]).toEqual({ error: "Poll block is missing its closing ```" });
  });
});

describe("pollsInContent", () => {
  it("gives each poll its slide and position", () => {
    const md = ["# One", poll("A?\n- x\n- y"), "", "---", "", poll("B?\n- x\n- y"), poll("C?\n- x\n- y")].join("\n");
    expect(pollsInContent(md).map((p) => [p.slide, p.blockIndex])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });
  it("doesn't split a slide on --- inside a poll", () => {
    expect(pollsInContent(poll("Q\n\n---\n\n- a\n- b"))).toHaveLength(1);
  });
});

describe("checkPoll", () => {
  it("trims and rejects duplicates", () => {
    expect(checkPoll({ question: " Q ", options: [" a ", "b"] })).toEqual({ poll: { question: "Q", options: ["a", "b"] } });
    expect(checkPoll({ question: "Q", options: ["A", "a"] })).toEqual({ error: "Options must be distinct" });
  });
  it("checks the correct index", () => {
    expect(checkPoll({ question: "Q", options: ["a", "b"], correctIndex: 2 })).toHaveProperty("error");
    expect(checkPoll({ question: "Q", options: ["a", "b"], correctIndex: 0 })).toHaveProperty("poll.correctIndex", 0);
  });
});
