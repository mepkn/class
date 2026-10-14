import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCircle2, CircleCheckBig, Loader2, Pointer } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { getVoterToken } from "@/lib/voterToken";
import { errorMessage } from "@/lib/errorMessage";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

type Session = FunctionReturnType<typeof api.classroom.getActiveSession>;
export type SessionPoll = NonNullable<Session["poll"]>;
export type InlinePoll = Session["inlinePolls"][number];

interface Props {
  poll: SessionPoll;
  /** Teacher monitor: show exactly what students see, but never vote. */
  readOnly?: boolean;
  /** Inside a lesson slide (a ```poll block) rather than taking over the screen. */
  inline?: boolean;
}

export function StudentPollView({ poll, readOnly = false, inline = false }: Props) {
  const [voterToken] = useState(() => (readOnly ? "" : getVoterToken()));
  const alreadyVoted = useQuery(
    api.polls.hasVoted,
    readOnly ? "skip" : { runId: poll._id, voterToken },
  );
  const submitVote = useMutation(api.polls.submitVote);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New poll → clear local state (adjusted during render, not in an effect).
  const [pollId, setPollId] = useState(poll._id);
  if (pollId !== poll._id) {
    setPollId(poll._id);
    setSelected(null);
    setError(null);
  }

  const voted = alreadyVoted === true || selected !== null;
  const results = poll.results;
  const hasResults = results !== null;

  // Mount bars at 0% then grow, so the reveal animates.
  const [barsGrown, setBarsGrown] = useState(false);
  if (!hasResults && barsGrown) setBarsGrown(false);
  useEffect(() => {
    if (!hasResults) return;
    const t = setTimeout(() => setBarsGrown(true), 40);
    return () => clearTimeout(t);
  }, [hasResults]);

  const canVote = !readOnly && !voted && !poll.showResults && alreadyVoted === false;

  const vote = async (index: number) => {
    if (!canVote || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitVote({ runId: poll._id, voterToken, selectedOption: index });
      setSelected(index);
    } catch (err) {
      const msg = errorMessage(err);
      if (/already voted/i.test(msg)) setSelected(index);
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "not-prose mx-auto flex w-full flex-col",
        inline
          ? "animate-fade-in my-6 max-w-3xl gap-4 rounded-2xl border border-white/15 border-l-4 border-l-primary/70 bg-white/[0.04] p-4 shadow-lg shadow-black/20 sm:p-6"
          : "max-w-2xl gap-6 px-4 py-8 sm:py-12",
      )}
    >
      <div className={cn("space-y-2", !inline && "text-center")}>
        <MarkdownRenderer
          content={poll.question}
          className={cn(
            "text-balance font-semibold leading-tight prose-p:my-0",
            inline ? "prose-lg sm:prose-xl" : "text-2xl sm:text-4xl prose-p:leading-tight",
          )}
        />
      </div>

      <ul className={cn("grid gap-3", poll.options.length > 4 && "sm:grid-cols-2")}>
        {poll.options.map((option, i) => {
          const isCorrect = results ? results.correctIndex === i : false;
          const count = results ? results.counts[i] : 0;
          const pct = results && results.total > 0 ? Math.round((count / results.total) * 100) : 0;
          const isMine = selected === i;

          return (
            <li key={i} className="animate-poll-in" style={{ "--i": i } as React.CSSProperties}>
              <button
                type="button"
                disabled={!canVote || submitting}
                onClick={() => vote(i)}
                className={cn(
                  "group relative flex min-h-16 w-full items-center gap-4 overflow-hidden rounded-xl border-2 px-5 py-4 text-left text-lg font-medium transition-all duration-200 sm:text-xl",
                  "border-white/15 bg-white/[0.06]",
                  canVote &&
                    "cursor-pointer hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/10 hover:shadow-md hover:shadow-black/30 active:translate-y-0 active:scale-[0.99]",
                  !canVote && "cursor-default",
                  canVote && submitting && "cursor-wait",
                  isMine && !results && "animate-poll-pop border-primary bg-primary/15",
                  voted && !isMine && !results && "opacity-50",
                  results && isCorrect && "border-success",
                )}
              >
                {results && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out",
                      isCorrect ? "bg-success/25" : "bg-white/10",
                    )}
                    style={{ width: barsGrown ? `${pct}%` : "0%" }}
                  />
                )}
                <span
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-base font-semibold transition-colors",
                    canVote && "group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
                    isMine && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {isMine && !results ? <Check className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="relative flex-1">{option}</span>
                {results && (
                  <span className="relative flex items-center gap-2 tabular-nums">
                    {isCorrect && <CircleCheckBig className="size-6 text-success" />}
                    {isMine && !isCorrect && <span className="text-sm text-muted-foreground">your vote</span>}
                    <span className="text-base text-muted-foreground">{pct}%</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="min-h-8 text-center text-base" aria-live="polite">
        {error && <p className="text-destructive">{error}</p>}
        {!error && results && (
          <p className="text-muted-foreground">
            {results.total} {results.total === 1 ? "vote" : "votes"}
            {results.correctIndex !== null && " · correct answer highlighted"}
          </p>
        )}
        {!error && !results && voted && (
          <p className="animate-fade-in inline-flex items-center gap-2 text-success">
            <CheckCircle2 className="size-5" /> Vote recorded · results soon
            <span className="ml-1 inline-flex gap-1" aria-hidden>
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-pulse rounded-full bg-success" style={{ animationDelay: `${d * 200}ms` }} />
              ))}
            </span>
          </p>
        )}
        {!error && !results && !voted && !readOnly && alreadyVoted === undefined && (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        )}
        {!error && !results && !voted && canVote && (
          <p className="inline-flex items-center gap-2 text-muted-foreground">
            <Pointer className="animate-poll-nudge size-5 text-primary" /> Pick one answer · you can't change it later
          </p>
        )}
        {readOnly && !results && (
          <p className="text-muted-foreground">Students are voting…</p>
        )}
      </div>
    </div>
  );
}
