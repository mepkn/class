import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Eye,
  Library,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Save,
  Search,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { PollInput } from "@convex/lib/pollRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errorMessage";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { PollForm } from "./PollForm";

interface Props {
  activeRunId: Id<"pollRuns"> | null;
  /** The lesson being edited (or the live one): its polls are listed first. */
  lesson: { _id: Id<"lessons">; lessonNumber: string; title: string } | null;
}

type Editing =
  | { kind: "new"; lessonId?: Id<"lessons"> }
  | { kind: "edit"; poll: Doc<"polls"> };

type Act = (fn: () => Promise<unknown>) => Promise<void>;

function toInput(poll: Doc<"polls">): PollInput {
  return { question: poll.question, options: poll.options, correctIndex: poll.correctIndex };
}

/** The Polls tab: the hand-launched poll's tally, the lesson's polls, and the poll bank. */
export function PollManager({ activeRunId, lesson }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createPoll = useMutation(api.polls.createPoll);
  const updatePoll = useMutation(api.polls.updatePoll);
  const launchNew = useMutation(api.polls.launchNew);

  const act: Act = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onEdit = (poll: Doc<"polls">) => setEditing({ kind: "edit", poll });

  return (
    <section className="space-y-5 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0">
      {activeRunId && <ActiveRun runId={activeRunId} />}

      {editing && (
        <div className="rounded-lg border bg-white/[0.02] p-3">
          <p className="mb-2 text-sm font-medium">
            {editing.kind === "edit"
              ? editing.poll.ownerLessonId
                ? "Edit poll"
                : "Edit bank poll · changes it in every lesson that uses it"
              : editing.lessonId && lesson
                ? `New poll for lesson ${lesson.lessonNumber}`
                : "New bank poll"}
          </p>
          <PollForm
            key={editing.kind === "edit" ? editing.poll._id : "new-" + (editing.lessonId ?? "bank")}
            initial={editing.kind === "edit" ? toInput(editing.poll) : undefined}
            onCancel={() => setEditing(null)}
            actions={
              editing.kind === "edit"
                ? [
                    {
                      label: "Save",
                      icon: <Save />,
                      run: async (p) => {
                        await updatePoll({ pollId: editing.poll._id, ...p });
                        setEditing(null);
                      },
                    },
                  ]
                : [
                    {
                      label: "Save",
                      icon: <Save />,
                      run: async (p) => {
                        await createPoll({ ...p, lessonId: editing.lessonId });
                        setEditing(null);
                      },
                    },
                    {
                      label: "Save & launch",
                      icon: <Rocket />,
                      run: async (p) => {
                        await launchNew({ ...p, lessonId: editing.lessonId });
                        setEditing(null);
                      },
                    },
                  ]
            }
          />
        </div>
      )}

      {lesson && (
        <LessonPolls
          lesson={lesson}
          onEdit={onEdit}
          onNew={() => setEditing({ kind: "new", lessonId: lesson._id })}
          act={act}
        />
      )}
      <PollBank lessonId={lesson?._id ?? null} onEdit={onEdit} onNew={() => setEditing({ kind: "new" })} act={act} />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

/** The poll launched by hand: live counts, Reveal, Close. */
function ActiveRun({ runId }: { runId: Id<"pollRuns"> }) {
  const tally = useQuery(api.polls.getRunTally, { runId });
  const revealRun = useMutation(api.polls.revealRun);
  const closeSaved = useMutation(api.polls.closeSaved);
  const [busy, setBusy] = useState<null | "reveal" | "close">(null);

  const run = async (kind: "reveal" | "close", fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs uppercase tracking-wide text-amber-500">On students' screens</p>
      {tally === undefined ? (
        <Loader2 className="size-4 animate-spin" />
      ) : tally === null ? (
        <p className="text-sm text-muted-foreground">Poll not found.</p>
      ) : (
        <>
          <MarkdownRenderer content={tally.question} className="font-medium prose-p:my-0" />
          <ul className="space-y-1.5">
            {tally.options.map((opt, i) => {
              const pct = tally.total ? (tally.counts[i] / tally.total) * 100 : 0;
              return (
                <li key={i} className="relative overflow-hidden rounded border px-2 py-1 text-sm">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-500",
                      i === tally.correctIndex ? "bg-success/20" : "bg-white/5",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex justify-between gap-2">
                    <span>
                      {String.fromCharCode(65 + i)}. {opt}
                      {i === tally.correctIndex && <span className="ml-1 text-success">✓</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{tally.counts[i]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm tabular-nums text-muted-foreground">
            Total votes: <span className="font-semibold text-foreground">{tally.total}</span>
            {tally.revealed && " · results revealed (voting closed)"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={tally.revealed || busy !== null}
              onClick={() => run("reveal", () => revealRun({ runId }))}
            >
              {busy === "reveal" ? <Loader2 className="animate-spin" /> : <Eye />} Reveal results
            </Button>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("close", () => closeSaved())}>
              {busy === "close" ? <Loader2 className="animate-spin" /> : <X />} Close &amp; back to lesson
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PollRow({
  poll,
  meta,
  children,
}: {
  poll: { question: string; options: string[]; correctIndex?: number };
  meta: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="space-y-1.5 rounded-md border px-3 py-2">
      <MarkdownRenderer content={poll.question} className="text-sm font-medium prose-p:my-0" />
      <p className="text-xs text-muted-foreground">
        {poll.options.length} options · {poll.correctIndex === undefined ? "opinion" : "quiz"} · {meta}
      </p>
      {children && <div className="flex flex-wrap gap-1">{children}</div>}
    </li>
  );
}

function SmallButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClick} title={label} aria-label={label}>
      {children}
    </Button>
  );
}

function LessonPolls({
  lesson,
  onEdit,
  onNew,
  act,
}: {
  lesson: NonNullable<Props["lesson"]>;
  onEdit: (poll: Doc<"polls">) => void;
  onNew: () => void;
  act: Act;
}) {
  const list = useQuery(api.polls.listLessonPolls, { lessonId: lesson._id });
  const launchSaved = useMutation(api.polls.launchSaved);
  const movePoll = useMutation(api.polls.movePoll);
  const unlinkPoll = useMutation(api.polls.unlinkPoll);
  const deletePoll = useMutation(api.polls.deletePoll);

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-start justify-between gap-2">
        <SectionHeading icon={<BookOpen />} title="This lesson" note={`${lesson.lessonNumber} · ${lesson.title}`} />
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNew}>
          <Plus /> New
        </Button>
      </div>
      {list === undefined ? (
        <Loader2 className="size-4 animate-spin" />
      ) : list === null ? null : list.saved.length + list.inline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No polls yet. Add one here, from the bank, or write a <code>```poll</code> block in the lesson.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {list.saved.map((poll, i) => (
            <PollRow key={poll.linkId} poll={poll} meta={poll.inBank ? "from the bank" : "this lesson"}>
              <SmallButton label="Launch now" onClick={() => act(() => launchSaved({ pollId: poll._id }))}>
                <Rocket /> Launch
              </SmallButton>
              <SmallButton label="Edit" onClick={() => onEdit(poll)}>
                <Pencil />
              </SmallButton>
              {i > 0 && (
                <SmallButton label="Move up" onClick={() => act(() => movePoll({ linkId: poll.linkId, direction: "up" }))}>
                  <ArrowUp />
                </SmallButton>
              )}
              {i < list.saved.length - 1 && (
                <SmallButton label="Move down" onClick={() => act(() => movePoll({ linkId: poll.linkId, direction: "down" }))}>
                  <ArrowDown />
                </SmallButton>
              )}
              {poll.inBank ? (
                <SmallButton
                  label="Remove from this lesson (stays in the bank)"
                  onClick={() => act(() => unlinkPoll({ linkId: poll.linkId }))}
                >
                  <Unlink />
                </SmallButton>
              ) : (
                <SmallButton
                  label="Delete poll"
                  onClick={() => window.confirm("Delete this poll?") && act(() => deletePoll({ pollId: poll._id }))}
                >
                  <Trash2 />
                </SmallButton>
              )}
            </PollRow>
          ))}
          {list.inline.map((block) =>
            "poll" in block ? (
              <PollRow
                key={`inline-${block.slide}-${block.blockIndex}`}
                poll={block.poll}
                meta={`inline · slide ${block.slide + 1} · edit it in the lesson`}
              />
            ) : (
              <li
                key={`inline-${block.slide}-${block.blockIndex}`}
                className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
              >
                Inline poll on slide {block.slide + 1}: {block.error}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function PollBank({
  lessonId,
  onEdit,
  onNew,
  act,
}: {
  lessonId: Id<"lessons"> | null;
  onEdit: (poll: Doc<"polls">) => void;
  onNew: () => void;
  act: Act;
}) {
  const [search, setSearch] = useState("");
  const bank = useQuery(api.polls.searchBank, { search });
  const linked = useQuery(api.polls.listLessonPolls, lessonId ? { lessonId } : "skip");
  const launchSaved = useMutation(api.polls.launchSaved);
  const linkPoll = useMutation(api.polls.linkPoll);
  const deletePoll = useMutation(api.polls.deletePoll);
  const inLesson = new Set(linked?.saved.map((p) => p._id));

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-start justify-between gap-2">
        <SectionHeading icon={<Library />} title="Poll bank" note="Reusable in any lesson" />
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNew}>
          <Plus /> New
        </Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" className="pl-8" />
      </div>
      {bank === undefined ? (
        <Loader2 className="size-4 animate-spin" />
      ) : bank.length === 0 ? (
        <p className="text-sm text-muted-foreground">{search ? "No matches." : "No bank polls yet."}</p>
      ) : (
        <ul className="space-y-1.5">
          {bank.map((poll) => (
            <PollRow
              key={poll._id}
              poll={poll}
              meta={
                poll.lessonCount === 0
                  ? "in no lesson"
                  : `in ${poll.lessonCount} lesson${poll.lessonCount === 1 ? "" : "s"}`
              }
            >
              <SmallButton label="Launch now" onClick={() => act(() => launchSaved({ pollId: poll._id }))}>
                <Rocket /> Launch
              </SmallButton>
              {lessonId && !inLesson.has(poll._id) && (
                <SmallButton label="Add to this lesson" onClick={() => act(() => linkPoll({ lessonId, pollId: poll._id }))}>
                  <Link2 /> Add to lesson
                </SmallButton>
              )}
              <SmallButton label="Edit (changes it in every lesson)" onClick={() => onEdit(poll)}>
                <Pencil />
              </SmallButton>
              <SmallButton
                label="Delete from the bank"
                onClick={() =>
                  window.confirm(
                    poll.lessonCount > 0
                      ? `Delete this poll? It's also removed from ${poll.lessonCount} lesson(s).`
                      : "Delete this poll?",
                  ) && act(() => deletePoll({ pollId: poll._id }))
                }
              >
                <Trash2 />
              </SmallButton>
            </PollRow>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A Polls-tab section title, with an optional muted line under it. */
export function SectionHeading({ icon, title, note }: { icon: React.ReactNode; title: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5">
        {icon} {title}
      </p>
      {note && <p className="mt-0.5 truncate text-sm">{note}</p>}
    </div>
  );
}
