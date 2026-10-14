import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Eye, RotateCcw, X } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpText } from "@/components/cmp/cmp-text";
import { MarkdownView } from "@/components/markdown";
import { ErrorText } from "@/components/section";
import { useAct } from "@/lib/use-act";

type Props =
  | { runId: Id<"pollRuns">; kind: "saved" }
  | { runId: Id<"pollRuns">; kind: "inline"; blockIndex: number };

/** A running poll: live counts, Reveal, then Close (hand-launched) or Run again (inline). */
export function RunCard(props: Props) {
  const tally = useQuery(api.polls.getRunTally, { runId: props.runId });
  const revealRun = useMutation(api.polls.revealRun);
  const closeSaved = useMutation(api.polls.closeSaved);
  const rerunInline = useMutation(api.polls.rerunInline);
  const { busy, error, act } = useAct();

  if (tally === undefined) return <ActivityIndicator />;
  if (tally === null) return null;
  return (
    <View className="gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <MarkdownView content={tally.question} />
      {tally.options.map((option, i) => {
        const pct = tally.total ? (tally.counts[i] / tally.total) * 100 : 0;
        const correct = i === tally.correctIndex;
        return (
          <View key={i} className="overflow-hidden rounded-md border border-border">
            <View
              className={correct ? "absolute inset-y-0 left-0 bg-success/25" : "absolute inset-y-0 left-0 bg-foreground/10"}
              style={{ width: `${pct}%` }}
            />
            <View className="flex-row justify-between gap-2 px-3 py-2">
              <CmpText className="flex-1" numberOfLines={2}>
                {String.fromCharCode(65 + i)}. {option}
                {correct ? "  ✓" : ""}
              </CmpText>
              <CmpText className="text-muted-foreground" style={{ fontVariant: ["tabular-nums"] }}>
                {tally.counts[i]}
              </CmpText>
            </View>
          </View>
        );
      })}
      <CmpText variant="muted">
        {tally.total} {tally.total === 1 ? "vote" : "votes"} · {tally.revealed ? "results shown" : "voting"}
      </CmpText>
      <View className="flex-row flex-wrap gap-2">
        <CmpButton
          size="sm"
          icon={Eye}
          label="Reveal"
          disabled={tally.revealed || busy}
          onPress={() => act(() => revealRun({ runId: props.runId }))}
        />
        {props.kind === "saved" ? (
          <CmpButton size="sm" variant="secondary" icon={X} label="Close" disabled={busy} onPress={() => act(() => closeSaved())} />
        ) : (
          <CmpButton
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            label="Run again"
            disabled={busy || (tally.total === 0 && !tally.revealed)}
            onPress={() => act(() => rerunInline({ blockIndex: props.blockIndex }))}
          />
        )}
      </View>
      <ErrorText error={error} />
    </View>
  );
}
