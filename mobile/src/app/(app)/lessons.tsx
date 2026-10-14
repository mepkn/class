import { api } from "@convex/_generated/api";
import type { LessonSummary } from "@convex/classroom";
import { segments } from "@convex/lib/lessonNumber";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Eraser, EyeOff, Lock, LogOut } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { CmpConfirmDialog } from "@/components/cmp/cmp-confirm-dialog";
import { CmpIcon } from "@/components/cmp/cmp-icon";
import { CmpText } from "@/components/cmp/cmp-text";
import { ErrorText } from "@/components/section";
import { useAct } from "@/lib/use-act";

type Pending = { kind: "lesson"; lesson: LessonSummary } | { kind: "blank" };

/** Every lesson and sub-lesson; tap one, confirm, and it goes to the class. */
export default function LessonsScreen() {
  const lessons = useQuery(api.classroom.getLessons);
  const session = useQuery(api.classroom.getActiveSession);
  const pushLesson = useMutation(api.classroom.pushLesson);
  const pushBlankBoard = useMutation(api.classroom.pushBlankBoard);
  const me = useQuery(api.auth.me);
  const { signOut } = useAuthActions();
  const { busy, error, act } = useAct();
  const [pending, setPending] = useState<Pending | null>(null);
  const liveId = session?.mode !== "intro" ? session?.activeLessonId : null;

  const confirm = () => {
    const p = pending;
    if (!p) return;
    void act(async () => {
      if (p.kind === "blank") await pushBlankBoard();
      else await pushLesson({ lessonId: p.lesson._id });
      router.navigate("/");
    });
  };

  return (
    <>
      <FlatList
        className="flex-1 bg-background"
        contentContainerClassName="gap-1 p-4"
        data={lessons ?? []}
        keyExtractor={(l) => l._id}
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <Pressable
              onPress={() => setPending({ kind: "blank" })}
              className="flex-row items-center gap-3 rounded-lg border border-border px-3 py-3 active:bg-accent">
              <CmpIcon as={Eraser} size={18} className="text-muted-foreground" />
              <CmpText className="flex-1 font-medium">Blank Blackboard</CmpText>
              {session?.mode === "lesson" && !session.activeLessonId && <LiveBadge />}
            </Pressable>
            <ErrorText error={error} />
            {lessons === undefined && <ActivityIndicator />}
          </View>
        }
        renderItem={({ item }) => {
          const depth = segments(item.lessonNumber).length - 1;
          const dim = item.isLocked || item.isHidden;
          return (
            <Pressable
              disabled={item.isLocked || busy}
              onPress={() => setPending({ kind: "lesson", lesson: item })}
              style={{ marginLeft: depth * 16 }}
              className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-accent">
              <CmpText className="min-w-4 text-muted-foreground" style={{ fontVariant: ["tabular-nums"] }}>
                {item.lessonNumber}
              </CmpText>
              <CmpText className={dim ? "flex-1 text-muted-foreground" : "flex-1"} numberOfLines={2}>
                {item.title || "Untitled"}
              </CmpText>
              {item.isHidden && <CmpIcon as={EyeOff} size={16} className="text-muted-foreground" />}
              {item.isLocked && <CmpIcon as={Lock} size={16} className="text-muted-foreground" />}
              {item._id === liveId && <LiveBadge />}
            </Pressable>
          );
        }}
      />
      {/* As on the web: pinned at the bottom, red, with the signed-in email. */}
      <View className="border-t border-border p-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="flex-row items-center gap-2 rounded-md px-3 py-2.5 active:bg-red-500/10">
          <CmpIcon as={LogOut} size={16} className="text-red-400" />
          <CmpText className="flex-1 text-sm font-medium text-red-400" numberOfLines={1}>
            Sign out{me?.email ? ` (${me.email})` : ""}
          </CmpText>
        </Pressable>
      </View>
      <CmpConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "lesson" ? `Push ${pending.lesson.lessonNumber} · ${pending.lesson.title}?` : "Clear the board?"}
        description="Students' screens switch now, and every poll result is cleared."
        confirmLabel={pending?.kind === "lesson" ? "Push to class" : "Blank Blackboard"}
        cancelLabel="Cancel"
        onConfirm={confirm}
      />
    </>
  );
}

function LiveBadge() {
  return (
    <View className="rounded-full bg-primary px-2 py-0.5">
      <CmpText className="text-xs font-semibold text-primary-foreground">Live</CmpText>
    </View>
  );
}
