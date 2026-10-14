import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { checkPoll, MAX_OPTION_CHARS, MAX_OPTIONS, MAX_QUESTION_CHARS, MIN_OPTIONS, type PollInput } from "@convex/lib/pollRules";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { errorMessage } from "@/lib/errorMessage";
import { MarkdownRenderer } from "./MarkdownRenderer";

export interface PollFormAction {
  label: string;
  icon?: React.ReactNode;
  run: (poll: PollInput) => Promise<unknown>;
}

interface Props {
  initial?: PollInput;
  actions: PollFormAction[];
  onCancel?: () => void;
}

const OPINION = "none";

/** Write or edit a poll: Markdown question, 2–6 plain options, an optional correct answer. */
export function PollForm({ initial, actions, onCancel }: Props) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", ""]);
  const [correct, setCorrect] = useState<string>(
    initial ? (initial.correctIndex === undefined ? OPINION : String(initial.correctIndex)) : "0",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const input: PollInput = {
    question,
    options,
    ...(correct === OPINION ? {} : { correctIndex: Number(correct) }),
  };
  const checked = checkPoll(input);

  const removeOption = (i: number) => {
    setOptions((opts) => opts.filter((_, j) => j !== i));
    setCorrect((c) => (c === OPINION ? c : Number(c) === i ? "0" : Number(c) > i ? String(Number(c) - 1) : c));
  };

  const submit = async (action: PollFormAction) => {
    if ("error" in checked) return setError(checked.error);
    setBusy(action.label);
    setError(null);
    try {
      await action.run(checked.poll);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), void submit(actions[0]))}>
      <div className="space-y-1.5">
        <Label htmlFor="poll-q">Question</Label>
        <textarea
          id="poll-q"
          value={question}
          maxLength={MAX_QUESTION_CHARS}
          rows={2}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What is $F$ if $m = 2$ and $a = 3$?"
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {/[$`*_]/.test(question) && (
          <div className="rounded-md border border-dashed px-3 py-2">
            <MarkdownRenderer content={question} className="text-sm prose-p:my-0" />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Options · pick the correct one, or none for an opinion poll</Label>
        <RadioGroup value={correct} onValueChange={(v) => setCorrect(String(v))} className="gap-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <RadioGroupItem value={String(i)} aria-label={`Option ${i + 1} is correct`} />
              <Input
                value={opt}
                maxLength={MAX_OPTION_CHARS}
                onChange={(e) => setOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={options.length <= MIN_OPTIONS}
                onClick={() => removeOption(i)}
                aria-label={`Remove option ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <RadioGroupItem value={OPINION} /> No correct answer (opinion poll)
          </label>
        </RadioGroup>
        {options.length < MAX_OPTIONS && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((o) => [...o, ""])}>
            <Plus /> Add option
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => (
          <Button
            key={action.label}
            type={i === 0 ? "submit" : "button"}
            size="sm"
            variant={i === 0 ? "default" : "secondary"}
            disabled={busy !== null || "error" in checked}
            onClick={i === 0 ? undefined : () => void submit(action)}
          >
            {busy === action.label ? <Loader2 className="animate-spin" /> : action.icon} {action.label}
          </Button>
        ))}
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
