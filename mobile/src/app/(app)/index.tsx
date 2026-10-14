import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { BarChart3, ChevronLeft, ChevronRight, CircleCheckBig, Eraser, Globe, NotebookPen, TriangleAlert, Undo2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { CmpButton } from "@/components/cmp/cmp-button";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { MarkdownView } from "@/components/markdown";
import { ErrorText } from "@/components/section";
import type { PollBlock } from "@convex/lib/inlinePolls";
import { lessonSlides, type SlidePart } from "@/lib/slide";
import { useAct } from "@/lib/use-act";

/**
 * The whole lesson in one scroll: the live slide outlined, later ones dimmed, your notes
 * where you wrote them. Prev / Next (here or on the web) scroll back to the live slide.
 */
export default function BoardScreen() {
  const session = useQuery(api.classroom.getActiveSession);
  const source = useQuery(api.classroom.getLiveSource);
  const lessons = useQuery(api.classroom.getLessons);
  const setSlide = useMutation(api.classroom.setSlide);
  const pushBlankBoard = useMutation(api.classroom.pushBlankBoard);
  const closeLinks = useMutation(api.classroom.closeLinks);
  const { busy, error, act } = useAct();
  const [confirmBlank, setConfirmBlank] = useState(false);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const slideY = useRef<number[]>([]);
  // Keeps the live slide in view while images above it load, until you scroll yourself.
  const follow = useRef(true);
  const index = session?.slide.index ?? 0;
  const lessonId = session?.activeLessonId;
  useEffect(() => {
    follow.current = true;
    const y = slideY.current[index];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [index, lessonId]);

  if (session === undefined || source === undefined) {
    return <ActivityIndicator className="flex-1 bg-background" />;
  }

  const lesson = lessons?.find((l) => l._id === session.activeLessonId);
  const slides = lessonSlides(source);
  const count = slides.length;

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= count) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void act(() => setSlide({ index: next }));
  };

  if (session.mode === "intro" || (!session.activeLessonId && source.trim() === "")) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <CmpText className="self-stretch text-center text-xl font-semibold">{session.mode === "intro" ? "Welcome screen is showing" : "The board is blank"}</CmpText>
        <CmpText variant="muted" className="text-center">Pick a lesson to push it to the class.</CmpText>
        <CmpButton label="Choose a lesson" onPress={() => router.navigate("/lessons")} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView ref={scroll} onScrollBeginDrag={() => (follow.current = false)} contentContainerClassName="gap-3 p-4">
        <View className="flex-row items-baseline gap-2">
          <CmpText className="flex-1 font-semibold" numberOfLines={1}>
            {lesson ? `${lesson.lessonNumber} · ${lesson.title}` : "Live board"}
          </CmpText>
          <CmpText className="text-muted-foreground" style={{ fontVariant: ["tabular-nums"] }}>
            {index + 1} / {count}
          </CmpText>
        </View>

        {session.mode === "poll" && (
          <Banner icon={BarChart3} text="A poll is on every screen." action="Polls" onPress={() => router.navigate("/polls")} />
        )}
        {session.link && <Banner icon={Globe} text={session.link} action="Links" onPress={() => router.navigate("/links")} />}

        {slides.map((parts, i) => (
          <View
            key={i}
            onLayout={(e) => {
              slideY.current[i] = e.nativeEvent.layout.y;
              if (i === index && follow.current) {
                scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 8), animated: false });
              }
            }}
            className={`gap-2 rounded-lg border-2 bg-board p-4 ${i === index ? "border-primary" : "border-transparent"} ${
              i > index ? "opacity-40" : ""
            }`}>
            <Pressable
              disabled={i === index}
              onPress={() => setJumpTo(i)}
              hitSlop={12}
              accessibilityLabel={i === index ? `Slide ${i + 1}, live` : `Jump to slide ${i + 1}`}
              className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 ${i === index ? "bg-primary" : "bg-muted"}`}>
              <CmpText
                className={`text-[11px] font-medium ${i === index ? "text-primary-foreground" : "text-muted-foreground"}`}
                style={{ fontVariant: ["tabular-nums"] }}>
                {i + 1}
              </CmpText>
            </Pressable>
            {parts.length === 0 ? <CmpText className="text-muted-foreground">Empty slide</CmpText> : parts.map((p, j) => <Part key={j} part={p} />)}
          </View>
        ))}
        <ErrorText error={error} />
      </ScrollView>

      <View className="gap-2 border-t border-border p-3">
        <View className="flex-row gap-2">
          <BigButton icon={ChevronLeft} label="Prev" disabled={index === 0} onPress={() => go(-1)} />
          <BigButton icon={ChevronRight} label="Next" primary disabled={index >= count - 1} onPress={() => go(1)} />
        </View>
        <View className="flex-row gap-2">
          <CmpButton className="flex-1" variant="outline" icon={Eraser} label="Blank Blackboard" onPress={() => setConfirmBlank(true)} />
          <CmpButton
            className="flex-1"
            variant={session.link ? "default" : "outline"}
            icon={Undo2}
            label="Back to board"
            disabled={busy}
            onPress={() => act(() => closeLinks())}
          />
        </View>
      </View>

      <CmpConfirmDialog
        open={confirmBlank}
        onOpenChange={setConfirmBlank}
        title="Clear the board?"
        description="Students see an empty board, and every poll result is cleared."
        confirmLabel="Blank Blackboard"
        cancelLabel="Cancel"
        onConfirm={() => act(() => pushBlankBoard())}
      />
      <CmpConfirmDialog
        open={jumpTo !== null}
        onOpenChange={(open) => !open && setJumpTo(null)}
        title={`Jump to slide ${(jumpTo ?? 0) + 1}?`}
        description="Every student moves to this slide."
        confirmLabel="Jump"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (jumpTo === null) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          void act(() => setSlide({ index: jumpTo }));
        }}
      />
    </View>
  );
}

function Part({ part }: { part: SlidePart }) {
  if (part.kind === "text") return <MarkdownView content={part.text} onBoard />;
  if (part.kind === "poll") return <PollPreview block={part.block} />;
  return (
    <View className="flex-row gap-2 rounded-lg border-l-2 border-primary bg-card px-3 py-2">
      <CmpIcon as={NotebookPen} size={16} className="mt-0.5 text-primary" />
      <CmpText className="flex-1">{part.text}</CmpText>
    </View>
  );
}

/** An inline poll as the web's teaching preview shows it: the answer marked, nothing live. */
function PollPreview({ block }: { block: PollBlock | undefined }) {
  return (
    <View className="gap-3 rounded-lg border border-dashed border-primary/50 p-4">
      <CmpText className="text-xs font-medium uppercase tracking-wide text-primary">Poll · starts on this slide</CmpText>
      {!block || "error" in block ? (
        <View className="flex-row items-center gap-2">
          <CmpIcon as={TriangleAlert} size={16} className="text-destructive" />
          <CmpText className="flex-1 text-sm text-destructive">{block ? block.error : "Empty poll"}</CmpText>
        </View>
      ) : (
        <>
          <MarkdownView content={block.poll.question} onBoard />
          <View className="gap-1.5">
            {block.poll.options.map((option, i) => (
              <View key={i} className="flex-row items-center gap-2 rounded border border-border px-3 py-1.5">
                <CmpText className="font-semibold">{String.fromCharCode(65 + i)}.</CmpText>
                <CmpText className="flex-1">{option}</CmpText>
                {i === block.poll.correctIndex && <CmpIcon as={CircleCheckBig} size={16} className="text-success" />}
              </View>
            ))}
          </View>
          {block.poll.correctIndex === undefined && (
            <CmpText className="text-xs text-muted-foreground">Opinion poll (no correct answer)</CmpText>
          )}
        </>
      )}
    </View>
  );
}

function BigButton({
  icon,
  label,
  primary = false,
  disabled,
  onPress,
}: {
  icon: typeof ChevronLeft;
  label: string;
  primary?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`h-20 flex-1 flex-row items-center justify-center gap-2 rounded-xl ${
        primary ? "bg-primary active:bg-primary/80" : "border border-border bg-secondary active:bg-accent"
      } ${disabled ? "opacity-40" : ""}`}>
      {label === "Prev" && <CmpIcon as={icon} size={28} className={primary ? "text-primary-foreground" : "text-foreground"} />}
      <CmpText className={`text-xl font-semibold ${primary ? "text-primary-foreground" : ""}`}>{label}</CmpText>
      {label === "Next" && <CmpIcon as={icon} size={28} className={primary ? "text-primary-foreground" : "text-foreground"} />}
    </Pressable>
  );
}

function Banner({ icon, text, action, onPress }: { icon: typeof Globe; text: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-2 rounded-lg bg-primary/15 px-3 py-2 active:bg-primary/25">
      <CmpIcon as={icon} size={16} className="text-primary" />
      <CmpText className="flex-1 text-sm" numberOfLines={1}>{text}</CmpText>
      <CmpText className="text-sm font-semibold text-primary">{action} ›</CmpText>
    </Pressable>
  );
}
