import { memo, useContext, useRef, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, CircleCheckBig, Copy, TriangleAlert } from "lucide-react";
import { parsePollBlocks } from "@convex/lib/inlinePolls";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PollSlotContext } from "@/lib/pollSlot";
import { LinkOpenContext } from "@/lib/linkOpen";
import { normalizeLink } from "@convex/lib/links";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function textOf(node: HastNode): string {
  return node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");
}

/**
 * Marks each ```poll block with its index (`data-poll`) and its source (`data-poll-source`),
 * and drops its language so highlight.js leaves it alone. `CodeBlock` renders it as a poll.
 */
function rehypePollSlots() {
  return (tree: HastNode) => {
    let index = 0;
    const walk = (node: HastNode) => {
      for (const child of node.children ?? []) {
        const code = child.tagName === "pre" ? child.children?.find((c) => c.tagName === "code") : undefined;
        const classes = code?.properties?.className;
        if (code && Array.isArray(classes) && classes.includes("language-poll")) {
          child.properties = { ...child.properties, dataPoll: index++, dataPollSource: textOf(code) };
          code.properties = { ...code.properties, className: [] };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}

const remarkPlugins = [remarkGfm, remarkMath];
// Order matters: polls are taken out first, then KaTeX renders math nodes before
// highlight.js sees code nodes.
const rehypePlugins: ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [
  rehypePollSlots,
  [rehypeKatex, { throwOnError: false, strict: false }],
  [rehypeHighlight, { detect: false }],
];

function languageOf(node: ExtraProps["node"]): string | null {
  const code = node?.children.find((c) => c.type === "element" && c.tagName === "code");
  if (!code || code.type !== "element") return null;
  const classes = code.properties?.className;
  const list = Array.isArray(classes) ? classes.map(String) : [];
  const lang = list.find((c) => c.startsWith("language-"));
  return lang ? lang.slice("language-".length) : null;
}

/** The teacher's editor preview of an inline poll: the answer is shown, nothing is live. */
function PollPreview({ source }: { source: string }) {
  const [block] = parsePollBlocks("```poll\n" + source + "```");
  return (
    <div className="not-prose my-5 space-y-3 rounded-lg border border-dashed border-primary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Poll · starts on this slide
      </p>
      {!block || "error" in block ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="size-4" /> {block ? block.error : "Empty poll"}
        </p>
      ) : (
        <>
          <MarkdownRenderer content={block.poll.question} />
          <ol className="space-y-1.5">
            {block.poll.options.map((option, i) => (
              <li key={i} className="flex items-center gap-2 rounded border px-3 py-1.5">
                <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {option}
                {i === block.poll.correctIndex && <CircleCheckBig className="ml-auto size-4 text-success" />}
              </li>
            ))}
          </ol>
          {block.poll.correctIndex === undefined && (
            <p className="text-xs text-muted-foreground">Opinion poll (no correct answer)</p>
          )}
        </>
      )}
    </div>
  );
}

function CodeBlock(props: ComponentProps<"pre"> & ExtraProps) {
  const slot = useContext(PollSlotContext);
  const index = props.node?.properties?.dataPoll;
  if (typeof index === "number") {
    if (slot) return <>{slot(index)}</>;
    return <PollPreview source={String(props.node?.properties?.dataPollSource ?? "")} />;
  }
  return <CodeView {...props} />;
}

function Link({ node: _node, href, ...props }: ComponentProps<"a"> & ExtraProps) {
  const open = useContext(LinkOpenContext);
  if (open === undefined) return <a href={href} {...props} target="_blank" rel="noopener noreferrer" />;
  const link = href ? normalizeLink(href) : null;
  return (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        e.preventDefault();
        if (link && open) open(link);
      }}
      className={cn(open && link ? "cursor-pointer" : "cursor-default")}
    />
  );
}

function CodeView({ node, children, ...rest }: ComponentProps<"pre"> & ExtraProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = languageOf(node);

  const copy = async () => {
    const text = preRef.current?.querySelector("code")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context) — ignore */
    }
  };

  return (
    <div className="not-prose group relative my-5 overflow-hidden rounded-lg border border-white/10 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5 text-xs text-zinc-400">
        <span className="font-mono uppercase tracking-wide">{lang ?? "code"}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-6 gap-1 px-1.5 text-xs font-normal text-zinc-400 hover:bg-white/10 hover:text-zinc-100 [&_svg]:size-3.5"
          aria-label="Copy code"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        ref={preRef}
        {...rest}
        className="overflow-x-auto whitespace-pre p-4 font-mono text-[0.9em] leading-relaxed text-zinc-100"
      >
        {children}
      </pre>
    </div>
  );
}

const components: Components = {
  pre: CodeBlock,
  a: Link,
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

function RawFallback({ content, error }: { content: string; error: Error }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-destructive">
        <TriangleAlert className="size-4" /> Couldn't render this content ({error.message}). Showing
        the raw Markdown instead.
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/30 p-4 font-mono text-sm">
        {content}
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * The single Markdown renderer used by students, the teacher's monitor,
 * and the editor preview. Raw HTML is skipped; bad LaTeX renders as red source.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "md-body prose prose-invert max-w-none prose-headings:font-semibold prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-primary prose-blockquote:not-italic prose-a:text-primary",
        className,
      )}
    >
      <ErrorBoundary
        resetKey={content}
        fallback={(error) => <RawFallback content={content} error={error} />}
      >
        <ReactMarkdown
          skipHtml
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </ErrorBoundary>
    </div>
  );
});
