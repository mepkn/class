import { useQuery } from "convex/react";
import { GraduationCap, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { StudentPollView } from "./StudentPollView";
import { cn } from "@/lib/utils";

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
    <div className={cn("relative h-full w-full overflow-hidden bg-board text-foreground", className)}>
      {session === undefined ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        // `key` gives each mode its own fade-in; content updates within a mode
        // re-render in place (no remount → no layout jump).
        <div key={session.mode} className="animate-fade-in h-full">
          {session.mode === "intro" && <IntroScreen />}
          {session.mode === "lesson" && <LessonCanvas content={session.currentContent} />}
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
