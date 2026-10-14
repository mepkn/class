import { X } from "lucide-react";
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
  return (
    <div className="animate-fade-in absolute inset-0 z-20 bg-board">
      <iframe
        src={embedUrl(url)}
        title={new URL(url).hostname}
        className="size-full bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      {onClose && (
        <Button size="sm" className="absolute bottom-3 right-3 shadow-lg" onClick={onClose}>
          <X /> Close
        </Button>
      )}
    </div>
  );
}
