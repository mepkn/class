import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, MonitorPlay, PanelLeft, PanelRight, SkipForward } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { LessonDrawer } from "@/components/LessonDrawer";
import { LiveEditor, type EditorTarget } from "@/components/LiveEditor";
import { PollManager } from "@/components/PollManager";
import { StatusBadge } from "@/components/StatusBadge";
import { StudentStage } from "@/components/StudentStage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BOARD_COLORS } from "../../convex/lib/boardColors";
import { Switch } from "@/components/ui/switch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { errorMessage } from "@/lib/errorMessage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TargetRef = { kind: "live"; nonce: number } | { kind: "lesson"; lessonId: Id<"lessons"> };

export function TeacherDashboard({ email }: { email: string | null }) {
  const { signOut } = useAuthActions();
  const session = useQuery(api.classroom.getActiveSession);
  const lessons = useQuery(api.classroom.getLessons);
  // Live board with presenter notes (students get a copy with notes stripped).
  const liveSource = useQuery(api.classroom.getLiveSource);

  const pushLesson = useMutation(api.classroom.pushLesson);
  const pushBlankBoard = useMutation(api.classroom.pushBlankBoard);
  const setDusterAnimation = useMutation(api.classroom.setDusterAnimation);
  const setBoardColor = useMutation(api.classroom.setBoardColor);

  const [targetRef, setTargetRef] = useState<TargetRef>({ kind: "live", nonce: 0 });
  const [autoSync, setAutoSync] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const liveLessonId = session?.activeLessonId ?? null;
  const liveLesson = lessons?.find((l) => l._id === liveLessonId) ?? null;
  const editingLesson =
    targetRef.kind === "lesson" ? (lessons?.find((l) => l._id === targetRef.lessonId) ?? null) : null;

  // ---- Unsaved-changes protection -------------------------------------------
  // The editor reports unsaved work here; anything that would discard it asks first.
  const unsavedRef = useRef<string | null>(null);
  const onUnsavedChange = useCallback((d: string | null) => {
    unsavedRef.current = d;
  }, []);

  /** Live edits students can see that were never saved into the live lesson's draft. */
  const unsavedLiveEdits =
    session?.mode === "lesson" && liveLesson && liveSource !== undefined && liveSource !== liveLesson.content
      ? `live edits to ${liveLesson.lessonNumber} — ${liveLesson.title} that aren't saved to its draft`
      : null;

  /** Native confirm listing what would be lost; true if nothing is at risk or the teacher agrees. */
  const confirmDiscard = (...reasons: (string | null)[]) => {
    const lost = reasons.filter((r): r is string => !!r);
    if (lost.length === 0) return true;
    return window.confirm(`You have ${lost.join(" and ")}.\n\nDiscard and continue?`);
  };
  const editorChanges = () => unsavedRef.current;

  /** Switch what the editor shows, asking first if that would drop unsaved work. */
  const goTo = (next: TargetRef) => {
    const same =
      next.kind === "lesson" && targetRef.kind === "lesson" && next.lessonId === targetRef.lessonId;
    if (same || confirmDiscard(editorChanges())) setTargetRef(next);
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(errorMessage(err, "Action failed"));
    }
  };

  const onPush = (lesson: Doc<"lessons">) => {
    const leavingEditor = !(targetRef.kind === "lesson" && targetRef.lessonId === lesson._id);
    if (!confirmDiscard(leavingEditor ? editorChanges() : null, unsavedLiveEdits)) return;
    return act(async () => {
      await pushLesson({ lessonId: lesson._id });
      setTargetRef({ kind: "lesson", lessonId: lesson._id });
    });
  };

  // ---- Next lesson ---------------------------------------------------------
  // The next pushable lesson (unlocked, not hidden) after the last pushed one, in sidebar
  // order (2 → 2.1 → 2.1.1 → 3). Nothing pushed yet → the first pushable lesson.
  const nextLesson = (() => {
    if (!lessons) return null;
    const from = liveLessonId ? lessons.findIndex((l) => l._id === liveLessonId) : -1;
    return lessons.slice(from + 1).find((l) => !l.isLocked && !l.isHidden) ?? null;
  })();
  const pushNext = () => {
    if (nextLesson) void onPush(nextLesson);
  };
  const pushNextRef = useRef(pushNext);
  pushNextRef.current = pushNext;
  useEffect(() => {
    // ⌘/Ctrl + Shift + Enter (works while typing in the editor; plain ⌘→ would move the cursor)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        pushNextRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onBlank = () => {
    if (!confirmDiscard(editorChanges(), unsavedLiveEdits)) return;
    return act(async () => {
      await pushBlankBoard();
      setTargetRef((t) => ({ kind: "live", nonce: (t.kind === "live" ? t.nonce : 0) + 1 }));
    });
  };

  // Build the editor target. The editor is keyed so it remounts per target.
  let editor: { target: EditorTarget; key: string; initial: string; broadcastable: boolean } | null =
    null;
  if (session !== undefined && liveSource !== undefined) {
    // A deleted lesson falls back to the live board.
    if (targetRef.kind === "live" || (lessons !== undefined && !editingLesson)) {
      editor = {
        target: { kind: "live" },
        key: `live-${targetRef.kind === "live" ? targetRef.nonce : "fallback"}`,
        initial: liveSource,
        broadcastable: true,
      };
    } else if (editingLesson) {
      editor = {
        target: { kind: "lesson", lesson: editingLesson },
        key: `lesson-${editingLesson._id}`,
        // The live lesson opens with what students see (may include unsaved live edits);
        // "Save draft" then stores those edits into the lesson.
        initial:
          session.mode === "lesson" && liveLessonId === editingLesson._id
            ? liveSource
            : editingLesson.content,
        broadcastable: liveLessonId === editingLesson._id,
      };
    }
  }

  return (
    // Two nested shadcn SidebarProviders: the outer one owns the left (lessons)
    // sidebar, the inner one the right (monitor/polls) sidebar.
    <SidebarProvider
      cookieName="sidebar_lessons"
      defaultOpen={readSidebarCookie("sidebar_lessons")}
      keyboardShortcut="b"
      className="h-svh"
      style={{ "--sidebar-width": "max(16rem, 25vw)" } as CSSProperties}
    >
      <LessonDrawer
        lessons={lessons}
        // Only "live" while students actually see it; after Reset or during a poll it can be pushed again.
        liveLessonId={session?.mode === "lesson" ? liveLessonId : null}
        editingLessonId={editingLesson?._id ?? null}
        onOpen={(l) => goTo({ kind: "lesson", lessonId: l._id })}
        onPush={onPush}
        onBlank={onBlank}
        onCreated={(lessonId) => setTargetRef({ kind: "lesson", lessonId })}
        confirmLeaveEditor={() => confirmDiscard(editorChanges())}
      />
      <WithSidebar>
        {(left) => (
          <SidebarProvider
            cookieName="sidebar_monitor"
            defaultOpen={readSidebarCookie("sidebar_monitor")}
            keyboardShortcut="."
            className="h-svh min-w-0 flex-1"
            style={{ "--sidebar-width": "max(20rem, 25vw)" } as CSSProperties}
          >
            <SidebarInset className="h-svh min-h-0 min-w-0">
              <header className="flex flex-wrap items-center gap-2 border-b bg-card/60 px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={left.toggleSidebar}
                  title="Toggle lessons (⌘/Ctrl+B)"
                  aria-label="Toggle lessons sidebar"
                >
                  <PanelLeft />
                </Button>
                <h1 className="flex items-center gap-2 font-semibold" title="Command Center">
                  <MonitorPlay className="size-5 text-primary" />
                  <span className="hidden 2xl:inline">Command Center</span>
                </h1>
                <div className="flex min-w-[10rem] flex-1 items-center gap-1">
                  <StatusBadge
                    mode={session?.mode}
                    lesson={liveLesson}
                    active={
                      targetRef.kind === "live" ||
                      (session?.mode === "lesson" && targetRef.lessonId === liveLessonId)
                    }
                    onClick={() =>
                      // Live lesson → select it in the sidebar; blank board/poll → scratchpad.
                      session?.mode === "lesson" && liveLesson
                        ? goTo({ kind: "lesson", lessonId: liveLesson._id })
                        : goTo({ kind: "live", nonce: Date.now() })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!nextLesson}
                    onClick={pushNext}
                    aria-label={nextLesson ? `Push next lesson: ${nextLesson.lessonNumber} — ${nextLesson.title}` : "No next lesson"}
                    title={
                      nextLesson
                        ? `Next: ${nextLesson.lessonNumber} — ${nextLesson.title} (⌘/Ctrl+Shift+Enter)`
                        : "No more unlocked lessons after this one"
                    }
                  >
                    <SkipForward />
                  </Button>
                </div>
                <RightSidebarTrigger />
              </header>

              {actionError && (
                <div className="flex items-center justify-between bg-destructive/15 px-4 py-1.5 text-sm text-destructive">
                  {actionError}
                  <button type="button" className="underline" onClick={() => setActionError(null)}>
                    Dismiss
                  </button>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col">
                {editor ? (
                  <LiveEditor
                    key={editor.key}
                    target={editor.target}
                    initialValue={editor.initial}
                    broadcastable={editor.broadcastable}
                    autoSync={autoSync}
                    onAutoSyncChange={setAutoSync}
              onUnsavedChange={onUnsavedChange}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Loading editor…
                  </div>
                )}
              </div>
            </SidebarInset>

            <Sidebar side="right">
              <Tabs defaultValue="monitor" className="flex min-h-0 flex-1 flex-col">
                <SidebarHeader className="border-b border-sidebar-border p-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="monitor" className="flex-1">
                      Classroom
                    </TabsTrigger>
                    <TabsTrigger value="poll" className="flex-1">
                      Polls {session?.mode === "poll" && "•"}
                    </TabsTrigger>
                  </TabsList>
                </SidebarHeader>
                <SidebarContent className="p-3">
                  <TabsContent value="monitor" className="mt-0 space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <Label htmlFor="duster" className="text-sm leading-snug">
                        Duster animation
                        <span className="block text-xs font-normal text-muted-foreground">
                          A hand wipes the board when you push a new lesson
                        </span>
                      </Label>
                      <Switch
                        id="duster"
                        checked={session?.dusterEnabled ?? true}
                        disabled={session === undefined}
                        onCheckedChange={(enabled) => act(() => setDusterAnimation({ enabled }))}
                      />
                    </div>
                    <div className="rounded-lg border px-3 py-2">
                      <p className="text-sm font-medium">
                        Board color
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · {BOARD_COLORS.find((c) => c.id === (session?.boardColor ?? "green"))?.label}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Board color">
                        {BOARD_COLORS.map((c) => {
                          const selected = (session?.boardColor ?? "green") === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              aria-label={c.label}
                              title={c.label}
                              disabled={session === undefined}
                              onClick={() => !selected && act(() => setBoardColor({ color: c.id }))}
                              className={cn(
                                "size-8 rounded-full border border-white/20 transition hover:scale-110",
                                selected && "ring-2 ring-primary ring-offset-2 ring-offset-sidebar",
                              )}
                              style={{ background: c.value }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <ScaledMonitor />
                  </TabsContent>
                  <TabsContent value="poll" className="mt-0">
                    <PollManager activePollId={session?.poll?._id ?? null} />
                    <div className="mt-6">
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Student view
                      </p>
                      <ScaledMonitor compact />
                    </div>
                  </TabsContent>
                </SidebarContent>
              </Tabs>
              <SidebarFooter className="border-t border-sidebar-border p-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => confirmDiscard(editorChanges()) && void signOut()}
                >
                  <LogOut />
                  <span className="truncate">Sign out{email ? ` (${email})` : ""}</span>
                </Button>
              </SidebarFooter>
            </Sidebar>
          </SidebarProvider>
        )}
      </WithSidebar>
    </SidebarProvider>
  );
}

/** shadcn's sidebar writes its open state to a cookie; read it back (default: open). */
function readSidebarCookie(name: string): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=(true|false)`));
  return match ? match[1] === "true" : true;
}

/** Exposes the nearest SidebarProvider's controls before a nested provider shadows it. */
function WithSidebar({ children }: { children: (ctx: ReturnType<typeof useSidebar>) => ReactNode }) {
  return <>{children(useSidebar())}</>;
}

function RightSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={toggleSidebar}
      title="Toggle monitor & polls (⌘/Ctrl+.)"
      aria-label="Toggle monitor and polls sidebar"
    >
      <PanelRight />
    </Button>
  );
}

/**
 * Renders StudentStage at a fixed "projector" size (1280×800) and scales it
 * down to the column width, so the teacher sees exactly what students see.
 */
function ScaledMonitor({ compact = false }: { compact?: boolean }) {
  const BASE_W = 1280;
  const BASE_H = 800;
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = width > 0 ? width / BASE_W : 0;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-lg border shadow-inner"
      style={{ height: BASE_H * scale, maxHeight: compact ? 260 : undefined }}
    >
      {scale > 0 && (
        <div
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        >
          <StudentStage readOnly />
        </div>
      )}
    </div>
  );
}
