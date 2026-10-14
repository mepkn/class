import { useState } from "react";
import { Globe, RotateCcw, X } from "lucide-react";
import { embedUrl } from "@convex/lib/links";
import { Button } from "@/components/ui/button";

interface Props {
  url: string;
  /** Set when the student opened it themselves; the teacher's links have no close button. */
  onClose?: () => void;
}

/**
 * A web page shown over the board, inside the class page: no new tab, and the page itself
 * can't open tabs or pop-ups (no `allow-popups`) or navigate the class page away.
 */
export function LinkPanel({ url, onClose }: Props) {
  const [reload, setReload] = useState(0);
  const host = new URL(url).hostname.replace(/^www\./, "");

  return (
    <div className="animate-fade-in absolute inset-0 z-20 flex flex-col bg-board">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-3 py-2 text-sm">
        <Globe className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 truncate font-medium">{host}</span>
        <span className="hidden shrink-0 text-muted-foreground sm:inline">
          {onClose ? "· opened by you" : "· shared by your teacher"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setReload((n) => n + 1)} title="Back to the page that was opened">
            <RotateCcw /> Back to start
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X /> Close
            </Button>
          )}
        </div>
      </div>
      <iframe
        key={reload}
        src={embedUrl(url)}
        title={host}
        className="min-h-0 flex-1 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      <p className="bg-black/30 px-3 py-1 text-center text-xs text-muted-foreground">
        Page blank? This site doesn't allow being shown here. Ask your teacher.
      </p>
    </div>
  );
}
