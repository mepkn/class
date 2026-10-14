// Rules every poll follows, whether saved (Polls tab, bank) or written inline in a lesson.

export const MAX_QUESTION_CHARS = 500;
export const MAX_OPTION_CHARS = 200;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export interface PollInput {
  question: string; // Markdown
  options: string[]; // plain text
  correctIndex?: number; // unset = opinion poll
}

/** Trims the poll and returns it, or a user-facing error message. */
export function checkPoll(input: PollInput): { poll: PollInput } | { error: string } {
  const question = input.question.trim();
  const options = input.options.map((o) => o.trim());
  if (!question || question.length > MAX_QUESTION_CHARS) {
    return { error: `Question must be 1–${MAX_QUESTION_CHARS} characters` };
  }
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { error: `A poll needs ${MIN_OPTIONS}–${MAX_OPTIONS} options` };
  }
  if (options.some((o) => !o || o.length > MAX_OPTION_CHARS)) {
    return { error: `Every option must be 1–${MAX_OPTION_CHARS} characters` };
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { error: "Options must be distinct" };
  }
  const { correctIndex } = input;
  if (
    correctIndex !== undefined &&
    (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length)
  ) {
    return { error: "Correct answer must be one of the options" };
  }
  return { poll: correctIndex === undefined ? { question, options } : { question, options, correctIndex } };
}
