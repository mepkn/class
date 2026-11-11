import { createContext, memo, useContext, useRef, useState, type ComponentProps } from "react";
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
import { cleanCopyText } from "@/lib/cleanCopyText";

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

const COPY_LANGS = new Set(["copy", "clip", "text", "prompt"]);

/**
 * Marks each ```copy block (and aliases like ```clip, ```prompt) with `dataCopyBlock`
 * and `dataCopySource`, dropping the language class so highlight.js leaves it alone.
 */
function rehypeCopyBlocks() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      for (const child of node.children ?? []) {
        const code = child.tagName === "pre" ? child.children?.find((c) => c.tagName === "code") : undefined;
        const classes = code?.properties?.className;
        const list = Array.isArray(classes) ? classes.map(String) : [];
        const isCopy = list.some((c) => {
          if (!c.startsWith("language-")) return false;
          const lang = c.slice("language-".length).toLowerCase();
          return COPY_LANGS.has(lang);
        });
        if (code && isCopy) {
          child.properties = { ...child.properties, dataCopyBlock: true, dataCopySource: textOf(code) };
          code.properties = { ...code.properties, className: [] };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}

const UNDERLINE_RE = /(?:\+\+([^\s+](?:[^\n+]*?[^\s+])?)\+\+|<u>([\s\S]*?)<\/u>)/;

/**
 * Transforms `++text++` (and `<u>text</u>`) into `<ins className="md-underline">` nodes.
 * Code blocks and inline code are left alone.
 */
function rehypeUnderline() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (!node.children || node.tagName === "pre" || node.tagName === "code") return;

      for (const child of node.children) {
        if (child.type === "element") walk(child);
      }

      const newChildren: HastNode[] = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === "text" && child.value && (child.value.includes("++") || child.value.includes("<u>"))) {
          let str = child.value;
          let match: RegExpExecArray | null;
          while ((match = UNDERLINE_RE.exec(str)) !== null) {
            const before = str.slice(0, match.index);
            const content = match[1] ?? match[2] ?? "";
            str = str.slice(match.index + match[0].length);
            if (before) newChildren.push({ type: "text", value: before });
            newChildren.push({
              type: "element",
              tagName: "ins",
              properties: { className: ["md-underline"] },
              children: [{ type: "text", value: content }],
            });
          }
          if (str) newChildren.push({ type: "text", value: str });
        } else {
          newChildren.push(child);
        }
      }

      // Check if ++ wraps sibling elements (e.g. ++**bold**++)
      let i = 0;
      const finalChildren: HastNode[] = [];
      while (i < newChildren.length) {
        const curr = newChildren[i];
        if (curr.type === "text" && curr.value && curr.value.endsWith("++")) {
          let j = i + 1;
          let found = -1;
          while (j < newChildren.length) {
            const nextChild = newChildren[j];
            if (nextChild && nextChild.type === "text" && nextChild.value?.startsWith("++")) {
              found = j;
              break;
            }
            j++;
          }
          if (found !== -1) {
            const before = curr.value.slice(0, -2);
            if (before) finalChildren.push({ type: "text", value: before });

            const wrappedChildren: HastNode[] = [];
            for (let k = i + 1; k < found; k++) {
              const childToWrap = newChildren[k];
              if (childToWrap) wrappedChildren.push(childToWrap);
            }
            finalChildren.push({
              type: "element",
              tagName: "ins",
              properties: { className: ["md-underline"] },
              children: wrappedChildren,
            });

            const closingNode = newChildren[found];
            const after = (closingNode?.value ?? "").slice(2);
            if (after && closingNode) {
              closingNode.value = after;
              i = found;
              continue;
            } else {
              i = found + 1;
              continue;
            }
          }
        }
        finalChildren.push(curr);
        i++;
      }

      node.children = finalChildren;
    };
    walk(tree);
  };
}

const remarkPlugins = [remarkGfm, remarkMath];
// Order matters: polls and copy blocks are taken out first, then KaTeX renders math nodes before
// highlight.js sees code nodes, and underline parses inline delimiters.
const rehypePlugins: ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [
  rehypePollSlots,
  rehypeCopyBlocks,
  [rehypeKatex, { throwOnError: false, strict: false }],
  [rehypeHighlight, { detect: false }],
  rehypeUnderline,
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

const InCopyCardContext = createContext(false);

/**
 * A copyable card for prompts, snippets, or any text students need to copy.
 * Renders formatted Markdown (including curly animating underlines) while copying
 * clean plain text with delimiters stripped.
 */
function CopyCard({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);
  const clean = cleanCopyText(source);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (e.g. insecure context) — ignore */
    }
  };

  return (
    <div className="not-prose group relative my-5 rounded-xl border border-white/15 bg-black/30 p-4 sm:p-5 shadow-sm transition-all hover:border-white/25">
      <div className="absolute right-3 top-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={copy}
          className="h-7 gap-1.5 px-2.5 text-xs font-medium hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          aria-label="Copy text"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="pr-16 text-foreground leading-relaxed text-base sm:text-lg select-text">
        <InCopyCardContext.Provider value={true}>
          <MarkdownRenderer content={source.trim()} />
        </InCopyCardContext.Provider>
      </div>
    </div>
  );
}

function CodeBlock(props: ComponentProps<"pre"> & ExtraProps) {
  const slot = useContext(PollSlotContext);
  const inCopyCard = useContext(InCopyCardContext);
  const index = props.node?.properties?.dataPoll;
  if (typeof index === "number") {
    const custom = slot?.(index);
    if (custom !== undefined) return <>{custom}</>;
    return <PollPreview source={String(props.node?.properties?.dataPollSource ?? "")} />;
  }
  if (props.node?.properties?.dataCopyBlock && !inCopyCard) {
    return <CopyCard source={String(props.node?.properties?.dataCopySource ?? "")} />;
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
  ins: ({ node: _node, className, ...props }) => (
    <ins className={className ?? "md-underline"} {...props} />
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
  /**
   * "curly" displays the underline as a wavy animating underline (for students and monitor preview).
   * "standard" (default) displays a crisp, solid underline (for the editor preview).
   */
  underlineStyle?: "curly" | "standard";
}

/**
 * The single Markdown renderer used by students, the teacher's monitor,
 * and the editor preview. Raw HTML is skipped; bad LaTeX renders as red source.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  underlineStyle = "standard",
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "md-body prose prose-invert max-w-none prose-headings:font-semibold prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-primary prose-blockquote:not-italic prose-a:text-primary",
        underlineStyle === "curly" && "md-underline-curly",
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
