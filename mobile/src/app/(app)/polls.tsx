import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Library, Presentation, Radio, Rocket } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpInput } from "@/components/cmp/cmp-field";
import { CmpText } from "@/components/cmp/cmp-text";
import { RunCard } from "@/components/run-card";
import { ErrorText, Section } from "@/components/section";
import { useAct } from "@/lib/use-act";

type PollLike = Pick<Doc<"polls">, "question" | "options" | "correctIndex">;

/** Runs polls written on the web: this slide's, this lesson's, and the bank's. */
export default function PollsScreen() {
  const session = useQuery(api.classroom.getActiveSession);
  const lessonId = session?.mode !== "intro" ? (session?.activeLessonId ?? null) : null;
  const lesson = useQuery(api.classroom.getLesson, lessonId ? { lessonId } : "skip");
  const list = useQuery(api.polls.listLessonPolls, lessonId ? { lessonId } : "skip");
  const [search, setSearch] = useState("");
  const bank = useQuery(api.polls.searchBank, { search });
  const launchSaved = useMutation(api.polls.launchSaved);
  const { busy, error, act } = useAct();

  if (session === undefined) return <ActivityIndicator className="flex-1 bg-background" />;
  const here = session.inlinePolls.filter((p) => p.slide === session.slide.index);

  const launch = (poll: Doc<"polls">) => (
    <CmpButton size="sm" icon={Rocket} label="Launch" disabled={busy} onPress={() => act(() => launchSaved({ pollId: poll._id }))} />
  );

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
      <ErrorText error={error} />
      {session.poll && (
        <Section icon={Radio} title="On every screen" note="Close deletes its votes">
          <RunCard kind="saved" runId={session.poll._id} />
        </Section>
      )}

      {here.length > 0 && (
        <Section icon={Presentation} title="On this slide" note="Closes when you move on">
          {here.map((p) => (
            <RunCard key={p._id} kind="inline" runId={p._id} blockIndex={p.blockIndex} />
          ))}
        </Section>
      )}

      <Section icon={BookOpen} title="This lesson" note={lesson ? `${lesson.lessonNumber} · ${lesson.title}` : undefined}>
        {!lessonId ? (
          <CmpText variant="muted">No lesson is live.</CmpText>
        ) : list === undefined ? (
          <ActivityIndicator />
        ) : !list || list.saved.length + list.inline.length === 0 ? (
          <CmpText variant="muted">No polls in this lesson. Write them on the web.</CmpText>
        ) : (
          <>
            {list.saved.map((poll) => (
              <PollRow key={poll.linkId} poll={poll} meta={poll.inBank ? "from the bank" : "this lesson"}>
                {launch(poll)}
              </PollRow>
            ))}
            {list.inline.map((block) =>
              "poll" in block ? (
                <PollRow
                  key={`inline-${block.slide}-${block.blockIndex}`}
                  poll={block.poll}
                  meta={`inline · slide ${block.slide + 1} · starts on its slide`}
                />
              ) : (
                <CmpText key={`inline-${block.slide}-${block.blockIndex}`} className="text-sm text-destructive">
                  Inline poll on slide {block.slide + 1}: {block.error}
                </CmpText>
              ),
            )}
          </>
        )}
      </Section>

      <Section icon={Library} title="Poll bank">
        <CmpInput value={search} onChangeText={setSearch} placeholder="Search questions…" autoCapitalize="none" />
        {bank === undefined ? (
          <ActivityIndicator />
        ) : bank.length === 0 ? (
          <CmpText variant="muted">{search.trim() ? "No bank polls match." : "The bank is empty."}</CmpText>
        ) : (
          bank.map((poll) => (
            <PollRow key={poll._id} poll={poll} meta={`in ${poll.lessonCount} ${poll.lessonCount === 1 ? "lesson" : "lessons"}`}>
              {launch(poll)}
            </PollRow>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function PollRow({ poll, meta, children }: { poll: PollLike; meta: string; children?: React.ReactNode }) {
  const kind = poll.correctIndex === undefined ? "opinion" : "quiz";
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-2">
      <View className="flex-1 gap-0.5">
        <CmpText numberOfLines={2}>{poll.question.replace(/\s+/g, " ").trim()}</CmpText>
        <CmpText className="text-xs text-muted-foreground">
          {poll.options.length} options · {kind} · {meta}
        </CmpText>
      </View>
      {children}
    </View>
  );
}
