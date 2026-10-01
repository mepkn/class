import { memo, useRef, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { cn } from "@/lib/utils";

const remarkPlugins = [remarkGfm, remarkMath];
// Order matters: KaTeX renders math nodes before highlight.js sees code nodes.
const rehypePlugins: ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [
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

function CodeBlock({ node, children, ...rest }: ComponentProps<"pre"> & ExtraProps) {
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
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-zinc-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
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
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
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
