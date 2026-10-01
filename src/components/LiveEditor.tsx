import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import MDEditor, { commands, type ICommand } from "@uiw/react-md-editor/nohighlight";
import { CircleDot, Code2, Link2, Loader2, Save, Sigma, StickyNote } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";
import { errorMessage } from "@/lib/errorMessage";

const MAX_BYTES = 200 * 1024;
// Auto-Sync waits this long after the last keystroke before sending (keeps Convex usage low).
const AUTO_SYNC_DELAY_MS = 1000;

function insertCommand(
  name: string,
  title: string,
  icon: React.ReactElement,
  build: (selected: string) => string,
): ICommand {
  return {
    name,
    keyCommand: name,
    buttonProps: { "aria-label": title, title },
    icon,
    execute: (state, api) => {
      api.replaceSelection(build(state.selectedText));
    },
  };
}

const quickInsert: ICommand[] = [
  insertCommand("python", "Insert Python code block", <Code2 className="size-3.5" />, (sel) =>
    `\n\`\`\`python\n${sel || "# your code here"}\n\`\`\`\n`,
  ),
  insertCommand("mathblock", "Insert $$ math block", <Sigma className="size-3.5" />, (sel) =>
    `\n$$\n${sel || "E = mc^2"}\n$$\n`,
  ),
  insertCommand("callout", "Insert callout", <StickyNote className="size-3.5" />, (sel) =>
    `\n> **Note:** ${sel || "…"}\n`,
  ),
  insertCommand("quicklink", "Insert link", <Link2 className="size-3.5" />, (sel) =>
    `[${sel || "link text"}](https://)`,
  ),
];

const toolbar: ICommand[] = [
  ...quickInsert,
  commands.divider,
  commands.bold,
  commands.italic,
  commands.title2,
  commands.quote,
  commands.code,
  commands.unorderedListCommand,
  commands.orderedListCommand,
  commands.table,
];
const extraToolbar: ICommand[] = [
  commands.codeEdit,
  commands.codeLive,
  commands.codePreview,
  commands.fullscreen,
];

export type EditorTarget = { kind: "live" } | { kind: "lesson"; lesson: Doc<"lessons"> };

interface Props {
  target: EditorTarget;
  /** Content to start from (live board content, or the lesson's saved draft). */
  initialValue: string;
  /** Whether edits in this editor should reach students (live board, or the live lesson). */
  broadcastable: boolean;
  autoSync: boolean;
  onAutoSyncChange: (on: boolean) => void;
  /** Called with a description of work that would be lost if the editor closed, or null. */
  onUnsavedChange?: (description: string | null) => void;
}

/**
 * Mount with a `key` per target so switching targets resets local state.
 */
export function LiveEditor({
  target,
  initialValue,
  broadcastable,
  autoSync,
  onAutoSyncChange,
  onUnsavedChange,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [lastSent, setLastSent] = useState(initialValue);
  const [inFlight, setInFlight] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLiveContent = useMutation(api.classroom.updateLiveContent);
  const updateLesson = useMutation(api.classroom.updateLesson);

  const bytes = useMemo(() => new TextEncoder().encode(value).length, [value]);
  const tooLarge = bytes > MAX_BYTES;

  const send = async (content: string) => {
    if (new TextEncoder().encode(content).length > MAX_BYTES) return;
    setInFlight((n) => n + 1);
    try {
      await updateLiveContent({ content });
      setLastSent(content);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to broadcast"));
    } finally {
      setInFlight((n) => n - 1);
    }
  };
  const debouncedSend = useDebouncedCallback(send, AUTO_SYNC_DELAY_MS);

  const onChange = (next: string) => {
    setValue(next);
    if (broadcastable && autoSync) debouncedSend.run(next);
  };

  // Turning auto-sync on (or a lesson becoming live) flushes pending edits.
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (broadcastable && autoSync && valueRef.current !== lastSent) {
      debouncedSend.run(valueRef.current);
    }
    if (!autoSync || !broadcastable) debouncedSend.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, broadcastable]);

  const unsent = broadcastable && value !== lastSent;
  const draftDirty = target.kind === "lesson" && value !== target.lesson.content;

  // What would be lost if this editor closed now. (Edits that already went live on the
  // live lesson are covered by the dashboard's "live edits not saved" check on push.)
  const unsavedDescription =
    broadcastable && !autoSync && unsent
      ? "unsent changes on the live board (Auto-Sync is paused)"
      : !broadcastable && draftDirty && target.kind === "lesson"
        ? `unsaved changes in ${target.lesson.lessonNumber} — ${target.lesson.title}`
        : null;
  useEffect(() => {
    onUnsavedChange?.(unsavedDescription);
  }, [unsavedDescription, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange?.(null), [onUnsavedChange]);

  const saveDraft = async () => {
    if (target.kind !== "lesson") return;
    setSavingDraft(true);
    try {
      await updateLesson({ lessonId: target.lesson._id, content: value });
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to save draft"));
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          {target.kind === "live" ? (
            <p className="truncate text-sm font-medium">Live board (scratchpad)</p>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <input
                key={`num-${target.lesson.lessonNumber}`}
                defaultValue={target.lesson.lessonNumber}
                maxLength={40}
                inputMode="decimal"
                aria-label="Lesson number"
                title="Edit the number. Sub-lessons move with it (e.g. 1 → 3 turns 1.2 into 3.2)."
                className="w-16 shrink-0 rounded border border-transparent bg-transparent px-1 font-mono hover:border-input focus:border-input focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = target.lesson.lessonNumber;
                    e.currentTarget.blur();
                  }
                }}
                onBlur={async (e) => {
                  const input = e.currentTarget;
                  const lessonNumber = input.value.trim();
                  if (!lessonNumber || lessonNumber === target.lesson.lessonNumber) {
                    input.value = target.lesson.lessonNumber;
                    return;
                  }
                  try {
                    await updateLesson({ lessonId: target.lesson._id, lessonNumber });
                    setError(null);
                  } catch (err) {
                    input.value = target.lesson.lessonNumber;
                    setError(errorMessage(err, "Failed to renumber"));
                  }
                }}
              />
              <span className="shrink-0">—</span>
              <input
                key={target.lesson.title}
                defaultValue={target.lesson.title}
                maxLength={200}
                aria-label="Lesson title"
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 hover:border-input focus:border-input focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = target.lesson.title;
                    e.currentTarget.blur();
                  }
                }}
                onBlur={async (e) => {
                  const title = e.currentTarget.value.trim();
                  if (!title || title === target.lesson.title) {
                    e.currentTarget.value = target.lesson.title;
                    return;
                  }
                  try {
                    await updateLesson({ lessonId: target.lesson._id, title });
                  } catch (err) {
                    setError(errorMessage(err, "Failed to rename"));
                  }
                }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {target.kind === "live"
              ? "Edits what students see right now."
              : broadcastable
                ? "Editing the live lesson's draft — changes can go live."
                : "Editing a draft — not visible to students until pushed."}
          </p>
        </div>

        {broadcastable && (
          <div className="flex items-center gap-2">
            <Switch
              id="autosync"
              checked={autoSync}
              onCheckedChange={onAutoSyncChange}
            />
            <Label
              htmlFor="autosync"
              className={autoSync ? "text-sm" : "text-sm text-amber-300"}
              title={autoSync ? "Pause to edit without students seeing it" : "Resume to send your edits to students"}
            >
              {autoSync ? "Live" : unsent ? "Paused · unsent changes" : "Paused"}
            </Label>
          </div>
        )}

        {target.kind === "lesson" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={saveDraft}
            disabled={!draftDirty || savingDraft || tooLarge}
          >
            {savingDraft ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-3 px-3 py-1 text-xs" aria-live="polite">
        {broadcastable && autoSync && (inFlight > 0 || unsent) && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Syncing…
          </span>
        )}
        {broadcastable && autoSync && inFlight === 0 && !unsent && (
          <span className="flex items-center gap-1 text-success">
            <CircleDot className="size-3" /> Live
          </span>
        )}
        {broadcastable && !autoSync && (
          <span className="text-muted-foreground">
            Paused — students see the last sent version. Switch back on to send your edits.
          </span>
        )}
        {draftDirty && <span className="text-muted-foreground">Draft has unsaved changes</span>}
        {tooLarge && (
          <span className="text-destructive">
            Content is {(bytes / 1024).toFixed(0)} KB — max 200 KB
          </span>
        )}
        {error && <span className="text-destructive">{error}</span>}
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3" data-color-mode="dark">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height="100%"
          visibleDragbar={false}
          preview="live"
          commands={toolbar}
          extraCommands={extraToolbar}
          textareaProps={{ placeholder: "Write Markdown, $math$, or ```python code…", spellCheck: false }}
          components={{
            preview: (source) => (
              <div className="p-4">
                <MarkdownRenderer content={source} />
              </div>
            ),
          }}
        />
      </div>
    </section>
  );
}
