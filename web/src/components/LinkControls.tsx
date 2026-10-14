import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ExternalLink, Globe, Loader2, RotateCw, TriangleAlert, Undo2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { linksIn } from "@convex/lib/links";
import { splitSlides } from "@convex/lib/slides";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errorMessage";

interface Props {
  /** The link open on every student's screen, if any. */
  link: string | null;
  /** The lesson's whole Markdown, every slide (its links are offered as one-click Show buttons). */
  content: string;
  /** Shown next to the list: the lesson the links come from. */
  source: string;
}

/** Classroom tab: open a web page on every student's screen, and bring everyone back to the board. */
export function LinkControls({ link, content, source }: Props) {
  const showLink = useMutation(api.classroom.showLink);
  const closeLinks = useMutation(api.classroom.closeLinks);
  const checkLink = useAction(api.links.checkLink);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each link once, with the first slide it's on.
  const seen = new Set<string>();
  const inLesson = splitSlides(content).flatMap((part, slide) =>
    linksIn(part)
      .filter((l) => !seen.has(l.url) && seen.add(l.url))
      .map((l) => ({ ...l, slide })),
  );
  const slides = splitSlides(content).length;
  const blocked = useQuery(api.links.blocked, inLesson.length > 0 ? { urls: inLesson.map((l) => l.url) } : "skip") ?? [];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border px-3 py-2">
      <p className="text-sm font-medium">
        Links
        <span className="block text-xs font-normal text-muted-foreground">
          Open a page on every screen, over the board. Only you can close it.
        </span>
      </p>
      {link && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1.5 text-xs">
          <Globe className="size-3.5 shrink-0 text-primary" />
          <a href={link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline" title={link}>
            {link}
          </a>
        </div>
      )}
      <Button
        size="sm"
        variant={link ? "default" : "outline"}
        className="w-full"
        disabled={busy}
        onClick={() => void run(() => closeLinks())}
        title="Closes your link and any link a student opened themselves"
      >
        <Undo2 /> Back to board
      </Button>
      <p className="truncate pt-1 text-xs text-muted-foreground">In {source}</p>
      {inLesson.length === 0 && <p className="text-xs text-muted-foreground/70">No links in this lesson.</p>}
      {inLesson.length > 0 && (
        <ul className="space-y-1">
          {inLesson.map((l) => (
            <li key={l.url} className="flex items-center gap-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate" title={l.url}>
                {l.text}
                {slides > 1 && <span className="ml-1 text-muted-foreground">· slide {l.slide + 1}</span>}
              </span>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Preview ${l.text} in a new tab`}
              >
                <ExternalLink className="size-3.5" />
              </a>
              {blocked.includes(l.url) ? (
                <span
                  className="flex h-6 items-center gap-1 px-1 text-xs text-amber-400"
                  title="This site can't be shown inside the class page. Students who click it get a new tab."
                >
                  <TriangleAlert className="size-3.5" /> New tab
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground"
                    disabled={busy}
                    onClick={() => void run(() => checkLink({ url: l.url }))}
                    aria-label={`Check ${l.text} again`}
                    title="Check again (the site may allow it now)"
                  >
                    <RotateCw className={busy ? "size-3 animate-spin" : "size-3"} />
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-xs"
                  disabled={busy || l.url === link}
                  onClick={() => void run(() => showLink({ url: l.url }))}
                >
                  {l.url === link ? "Showing" : "Show"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!(await checkLink({ url }))) {
              throw new Error("This site can't be shown inside the class page. Open it on your own screen instead.");
            }
            await showLink({ url });
            setUrl("");
          });
        }}
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link…"
          className="h-8 text-xs"
          aria-label="Link to show the class"
        />
        <Button type="submit" size="sm" disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : "Show"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
