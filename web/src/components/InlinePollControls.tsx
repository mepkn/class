import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Eye, Loader2, Presentation, RotateCcw } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errorMessage";
import type { InlinePoll } from "./StudentPollView";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SectionHeading } from "./PollManager";

/** The current slide's inline polls: live counts, Reveal and Run again. */
export function InlinePollControls({ polls, slide }: { polls: InlinePoll[]; slide: number }) {
  const here = polls.filter((p) => p.slide === slide);
  if (here.length === 0) return null;
  return (
    <section className="space-y-2 border-b pb-4">
      <SectionHeading icon={<Presentation />} title="On this slide" note="Inline poll · closes when you move on" />
      {here.map((poll) => (
        <InlinePollCard key={poll._id} runId={poll._id} blockIndex={poll.blockIndex} />
      ))}
    </section>
  );
}

function InlinePollCard({ runId, blockIndex }: { runId: Id<"pollRuns">; blockIndex: number }) {
  const tally = useQuery(api.polls.getRunTally, { runId });
  const revealRun = useMutation(api.polls.revealRun);
  const rerunInline = useMutation(api.polls.rerunInline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!tally) return <Loader2 className="size-4 animate-spin" />;
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <MarkdownRenderer content={tally.question} className="text-sm font-medium prose-p:my-0" />
      <ul className="space-y-1">
        {tally.options.map((opt, i) => {
          const pct = tally.total ? (tally.counts[i] / tally.total) * 100 : 0;
          return (
            <li key={i} className="relative overflow-hidden rounded border px-2 py-0.5 text-sm">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500",
                  i === tally.correctIndex ? "bg-success/20" : "bg-white/5",
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex justify-between gap-2">
                <span className="truncate">
                  {String.fromCharCode(65 + i)}. {opt}
                  {i === tally.correctIndex && <span className="ml-1 text-success">✓</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{tally.counts[i]}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground">
        {tally.total} {tally.total === 1 ? "vote" : "votes"}
        {tally.revealed ? " · results shown" : " · voting"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={tally.revealed || busy} onClick={() => act(() => revealRun({ runId }))}>
          <Eye /> Reveal
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || (tally.total === 0 && !tally.revealed)}
          onClick={() => act(() => rerunInline({ blockIndex }))}
        >
          <RotateCcw /> Run again
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
