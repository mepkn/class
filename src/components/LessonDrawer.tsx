import { useState } from "react";
import { useMutation } from "convex/react";
import { ChevronDown, ChevronRight, Eye, EyeOff, ListPlus, Lock, LockOpen, Plus, Radio, Eraser, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { LessonSummary } from "../../convex/classroom";
import { errorMessage } from "@/lib/errorMessage";
import { parentNumber } from "../../convex/lib/lessonNumber";
import { Hint } from "@/components/Hint";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface Props {
  lessons: LessonSummary[] | undefined;
  liveLessonId: Id<"lessons"> | null;
  editingLessonId: Id<"lessons"> | null;
  onOpen: (lesson: LessonSummary) => void;
  onPush: (lesson: LessonSummary) => void;
  onBlank: () => void;
  onCreated: (lessonId: Id<"lessons">) => void;
  /** Asks before the editor is switched away from unsaved work; false = cancel. */
  confirmLeaveEditor: () => boolean;
  /** Teaching mode: only opening and pushing lessons; no creating/editing/deleting. */
  readOnly?: boolean;
}

export function LessonDrawer({ lessons, liveLessonId, editingLessonId, onOpen, onPush, onBlank, onCreated, confirmLeaveEditor, readOnly = false }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<Id<"lessons">>>(new Set());
  const toggleCollapsed = (id: Id<"lessons">) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const updateLesson = useMutation(api.classroom.updateLesson);
  const createLesson = useMutation(api.classroom.createLesson);
  const deleteLesson = useMutation(api.classroom.deleteLesson);

  const guard = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const visible = lessons?.filter((l) => !l.isHidden) ?? [];
  const hidden = lessons?.filter((l) => l.isHidden) ?? [];

  // Tree of visible lessons. A lesson whose parent is hidden is shown at the top level.
  const visibleNumbers = new Set(visible.map((l) => l.lessonNumber));
  const childrenOf = new Map<string, LessonSummary[]>();
  const roots: LessonSummary[] = [];
  for (const l of visible) {
    const p = parentNumber(l.lessonNumber);
    if (p && visibleNumbers.has(p)) childrenOf.set(p, [...(childrenOf.get(p) ?? []), l]);
    else roots.push(l);
  }

  const renderTree = (lesson: LessonSummary, depth: number): React.ReactNode => {
    const kids = childrenOf.get(lesson.lessonNumber) ?? [];
    const isCollapsed = collapsed.has(lesson._id);
    return (
      <li key={lesson._id}>
        <ul>{row(lesson, depth, kids.length, isCollapsed)}</ul>
        {kids.length > 0 && !isCollapsed && (
          <ul className="space-y-1">{kids.map((k) => renderTree(k, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const row = (lesson: LessonSummary, depth = 0, childCount = 0, isCollapsed = false) => {
    const isLive = lesson._id === liveLessonId;
    const isEditing = lesson._id === editingLessonId;
    return (
      <li
        key={lesson._id}
        className={cn(
          "group rounded-lg border border-transparent py-2 pr-2 transition-colors",
          isLive
            ? "bg-amber-400/20 hover:bg-amber-400/25"
            : isEditing
              ? "border-primary/40 bg-accent"
              : "hover:bg-accent/60",
          isLive && isEditing && "ring-1 ring-primary",
          lesson.isHidden && "opacity-70",
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <div className="flex items-start gap-1">
        {childCount > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleCollapsed(lesson._id)}
            className="mt-0.5 size-4 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            aria-label={isCollapsed ? `Expand ${childCount} sub-lessons` : "Collapse sub-lessons"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
          </Button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Button
          variant="ghost"
          onClick={() => onOpen(lesson)}
          className="h-auto min-w-0 flex-1 items-start justify-start gap-2 p-0 text-left font-normal whitespace-normal hover:bg-transparent"
          title="Open in editor"
        >
          <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
            {lesson.lessonNumber}
          </span>
          <span className="flex-1 text-sm leading-snug">{lesson.title}</span>
          {isLive && (
            <span className="shrink-0 rounded bg-red-500 px-1.5 text-[10px] font-bold uppercase text-white shadow-sm">
              Live
            </span>
          )}
          {isCollapsed && (
            <span className="shrink-0 text-[10px] text-muted-foreground">+{childCount}</span>
          )}
        </Button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 pl-5">
          {!isLive && !readOnly && (
            <>
              <Hint label={lesson.isLocked ? "Unlock lesson" : "Lock lesson"}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={lesson.isLocked ? "Unlock lesson" : "Lock lesson"}
                  onClick={() => updateLesson({ lessonId: lesson._id, isLocked: !lesson.isLocked })}
                >
                  {lesson.isLocked ? <Lock className="text-amber-300" /> : <LockOpen />}
                </Button>
              </Hint>
              <Hint label={lesson.isHidden ? "Unhide lesson" : "Hide lesson"}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={lesson.isHidden ? "Unhide lesson" : "Hide lesson"}
                  onClick={() => updateLesson({ lessonId: lesson._id, isHidden: !lesson.isHidden })}
                >
                  {lesson.isHidden ? <EyeOff /> : <Eye />}
                </Button>
              </Hint>
            </>
          )}
          {!readOnly && (
            <Hint label={`Add sub-lesson under ${lesson.lessonNumber}`}>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Add sub-lesson under ${lesson.lessonNumber}`}
                onClick={() =>
                  confirmLeaveEditor() &&
                  guard(async () => {
                    const id = await createLesson({ parentId: lesson._id });
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      next.delete(lesson._id);
                      return next;
                    });
                    onCreated(id);
                  })
                }
              >
                <ListPlus />
              </Button>
            </Hint>
          )}
          {!isLive && !readOnly && (
            <AlertDialog>
              <Hint label="Delete lesson">
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" aria-label="Delete lesson">
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
              </Hint>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete lesson {lesson.lessonNumber} — “{lesson.title}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void guard(() => deleteLesson({ lessonId: lesson._id }))}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isLive && (
            <Button
              size="sm"
              variant="default"
              className="ml-auto h-7"
              disabled={lesson.isLocked}
              title={lesson.isLocked ? "Unlock the lesson to push it" : "Show this lesson to every student"}
              onClick={() => onPush(lesson)}
            >
              <Radio /> Push to Room
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <Sidebar side="left">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <Button variant="outline" className="w-full" onClick={onBlank}>
          <Eraser /> Blank Blackboard
        </Button>
        {!readOnly && (
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => confirmLeaveEditor() && guard(async () => onCreated(await createLesson({})))}
          >
            <Plus /> New Lesson
          </Button>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </SidebarHeader>
      <SidebarContent className="p-2">
        {lessons === undefined ? (
          <ul className="space-y-2 p-1" aria-label="Loading lessons">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </ul>
        ) : lessons.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No lessons yet. Run <code className="font-mono">npx convex run seed:default</code>.
          </p>
        ) : (
          <>
            <ul className="space-y-1">{roots.map((l) => renderTree(l, 0))}</ul>
            {hidden.length > 0 && (
              <Collapsible open={showHidden} onOpenChange={setShowHidden} className="mt-3 border-t pt-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-1 px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:bg-transparent hover:text-foreground"
                  >
                    {showHidden ? <ChevronDown /> : <ChevronRight />}
                    Show hidden ({hidden.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <ul className="mt-1 space-y-1">{hidden.map((l) => row(l))}</ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
