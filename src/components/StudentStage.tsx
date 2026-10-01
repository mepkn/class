import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "convex/react";
import { GraduationCap, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { StudentPollView } from "./StudentPollView";
import { DusterWipe } from "./DusterWipe";
import { cn } from "@/lib/utils";
import { boardColorValue } from "../../convex/lib/boardColors";

interface Props {
  /** Teacher's Live Student Monitor: same UI, but voting is disabled. */
  readOnly?: boolean;
  className?: string;
}

/**
 * THE student view. Rendered full-screen at `/` and scaled-down in the
 * teacher's monitor. It only ever reads from the `getActiveSession`
 * subscription — never from local editor state.
 */
export function StudentStage({ readOnly = false, className }: Props) {
  const session = useQuery(api.classroom.getActiveSession);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-board text-foreground transition-colors duration-500",
        className,
      )}
      // Teacher-chosen board color; also used by the duster wipe's old-board layer.
      style={{ "--board": boardColorValue(session?.boardColor) } as CSSProperties}
    >
      {session === undefined ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        // `key` gives each mode its own fade-in; content updates within a mode
        // re-render in place (no remount → no layout jump).
        <div key={session.mode} className="animate-fade-in h-full">
          {session.mode === "intro" && <IntroScreen />}
          {session.mode === "lesson" && (
            <LessonBoard
              content={session.currentContent}
              pushedAt={session.pushedAt}
              dusterEnabled={session.dusterEnabled}
            />
          )}
          {session.mode === "poll" &&
            (session.poll ? (
              <div className="h-full overflow-y-auto">
                <StudentPollView poll={session.poll} readOnly={readOnly} />
              </div>
            ) : (
              <IntroScreen />
            ))}
        </div>
      )}
    </div>
  );
}

function IntroScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="relative flex items-center justify-center">
        <span className="animate-breathe absolute size-40 rounded-full bg-primary/20 blur-2xl" />
        <GraduationCap className="relative size-16 text-primary" strokeWidth={1.5} />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Welcome to AI Class.</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">Waiting for session to start…</p>
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The lesson board. When the teacher pushes a new lesson / blank board
 * (`pushedAt` changes), a hand with a duster wipes the old board away.
 * Live edits (same `pushedAt`) never trigger it, and neither does the first
 * render (mounts on page load or when coming back from a poll/standby).
 */
function LessonBoard({
  content,
  pushedAt,
  dusterEnabled,
}: {
  content: string;
  pushedAt: number | null;
  dusterEnabled: boolean;
}) {
  const prev = useRef({ pushedAt, content });
  const [wipe, setWipe] = useState<{ id: number; oldContent: string } | null>(null);

  useEffect(() => {
    const before = prev.current;
    if (
      pushedAt !== null &&
      pushedAt !== before.pushedAt &&
      dusterEnabled &&
      before.content.trim() !== "" && // nothing to wipe off an already-clean board
      !prefersReducedMotion()
    ) {
      setWipe({ id: pushedAt, oldContent: before.content });
    }
    prev.current = { pushedAt, content };
  }, [pushedAt, content, dusterEnabled]);

  return (
    <div className="relative h-full">
      <LessonCanvas content={content} />
      {wipe && (
        <DusterWipe key={wipe.id} onDone={() => setWipe(null)}>
          <LessonCanvas content={wipe.oldContent} />
        </DusterWipe>
      )}
    </div>
  );
}

function LessonCanvas({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">
      <article className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-10 sm:py-12">
        {content.trim() === "" ? (
          <p className="pt-24 text-center text-lg text-muted-foreground/60">
            The board is clean.
          </p>
        ) : (
          <MarkdownRenderer
            content={content}
            className="prose-lg sm:prose-xl prose-p:leading-relaxed"
          />
        )}
      </article>
    </div>
  );
}
