import { cn } from "@/lib/utils";

interface Props {
  mode: "intro" | "lesson" | "poll" | undefined;
  lesson: { lessonNumber: string; title: string } | null;
  /** Opens the live board in the editor. */
  onClick?: () => void;
  /** True while the editor is on the live board. */
  active?: boolean;
}

export function StatusBadge({ mode, lesson, onClick, active = false }: Props) {
  let text: string;
  let tone: string;
  if (mode === undefined) {
    text = "Connecting…";
    tone = "border-border text-muted-foreground";
  } else if (mode === "intro") {
    text = "⚪ Standby";
    tone = "border-border text-muted-foreground";
  } else if (mode === "poll") {
    text = "📊 Poll Running";
    tone = "border-amber-500/50 bg-amber-500/10 text-amber-200";
  } else if (lesson) {
    text = `🔴 Live: ${lesson.lessonNumber} — ${lesson.title}`;
    tone = "border-red-500/50 bg-red-500/10 text-red-100";
  } else {
    text = "🔴 Live: Blank Board";
    tone = "border-red-500/50 bg-red-500/10 text-red-100";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title="Edit what students see right now"
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border px-3 py-1 text-sm font-medium transition hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100",
        active && "ring-2 ring-ring/60",
        tone,
      )}
      aria-pressed={active}
    >
      <span role="status" className="truncate">{text}</span>
    </button>
  );
}
