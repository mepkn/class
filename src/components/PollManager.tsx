import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BarChart3, Eye, Loader2, Plus, Rocket, Trash2, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errorMessage";

interface Props {
  activePollId: Id<"polls"> | null;
}

export function PollManager({ activePollId }: Props) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [busy, setBusy] = useState<null | "launch" | "reveal" | "close">(null);
  const [error, setError] = useState<string | null>(null);

  const launchPoll = useMutation(api.polls.launchPoll);
  const revealPollResults = useMutation(api.polls.revealPollResults);
  const closePoll = useMutation(api.polls.closePoll);
  const tally = useQuery(api.polls.getPollVotes, activePollId ? { pollId: activePollId } : "skip");

  const trimmed = options.map((o) => o.trim());
  const formValid =
    question.trim().length > 0 &&
    trimmed.every((o) => o.length > 0) &&
    new Set(trimmed.map((o) => o.toLowerCase())).size === trimmed.length;

  const run = async (kind: "launch" | "reveal" | "close", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const removeOption = (i: number) => {
    setOptions((opts) => opts.filter((_, j) => j !== i));
    setCorrectIndex((c) => (c === i ? 0 : c > i ? c - 1 : c));
  };

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <BarChart3 className="size-4" /> Poll Manager
      </h2>

      {activePollId && (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          {tally === undefined ? (
            <Loader2 className="size-4 animate-spin" />
          ) : tally === null ? (
            <p className="text-sm text-muted-foreground">Poll not found.</p>
          ) : (
            <>
              <p className="font-medium">{tally.question}</p>
              <ul className="space-y-1.5">
                {tally.options.map((opt, i) => {
                  const pct = tally.total ? (tally.counts[i] / tally.total) * 100 : 0;
                  return (
                    <li key={i} className="relative overflow-hidden rounded border px-2 py-1 text-sm">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 transition-[width] duration-500",
                          i === tally.correctIndex ? "bg-success/20" : "bg-white/5",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative flex justify-between gap-2">
                        <span>
                          {String.fromCharCode(65 + i)}. {opt}
                          {i === tally.correctIndex && <span className="ml-1 text-success">✓</span>}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{tally.counts[i]}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm tabular-nums text-muted-foreground">
                Total votes: <span className="font-semibold text-foreground">{tally.total}</span>
                {tally.showResults && " · results revealed (voting closed)"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={tally.showResults || busy !== null}
                  onClick={() => run("reveal", () => revealPollResults())}
                >
                  {busy === "reveal" ? <Loader2 className="animate-spin" /> : <Eye />} Reveal Results
                  &amp; Answer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => run("close", () => closePoll())}
                >
                  {busy === "close" ? <Loader2 className="animate-spin" /> : <X />} Close Poll &amp;
                  Return to Lesson
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!formValid) return;
          void run("launch", async () => {
            await launchPoll({ question: question.trim(), options: trimmed, correctIndex });
            setQuestion("");
            setOptions(["", ""]);
            setCorrectIndex(0);
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="poll-q">Question</Label>
          <Input
            id="poll-q"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What does gradient descent minimise?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Options (select the correct answer)</Label>
          <RadioGroup
            value={String(correctIndex)}
            onValueChange={(v) => setCorrectIndex(Number(v))}
            className="gap-2"
          >
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} id={`opt-${i}`} aria-label={`Option ${i + 1} is correct`} />
                <Input
                  value={opt}
                  maxLength={200}
                  onChange={(e) =>
                    setOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={options.length <= 2}
                  onClick={() => removeOption(i)}
                  aria-label={`Remove option ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </RadioGroup>
          {options.length < 4 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOptions((o) => [...o, ""])}
            >
              <Plus /> Add option
            </Button>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={!formValid || busy !== null}>
          {busy === "launch" ? <Loader2 className="animate-spin" /> : <Rocket />} Launch Poll
        </Button>
        {activePollId && (
          <p className="text-xs text-muted-foreground">Launching replaces the current poll.</p>
        )}
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
