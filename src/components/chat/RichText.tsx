import { Fragment, type ReactNode } from "react";
import { HELPLINE_NUMBERS } from "@/lib/helplines";

/**
 * Renders the small subset of markdown the assistant produces:
 * paragraphs, numbered lists, bulleted lists and **bold**. Known helpline
 * numbers become tel: links in a mono font.
 *
 * This is a deliberately tiny, safe renderer: it never uses
 * dangerouslySetInnerHTML, so streamed model text cannot inject markup.
 */
export function RichText({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-muted">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "ol"; items: string[] }
  | { type: "ul"; items: string[] };

function splitBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", text: paragraph.join("\n").trim() });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

    if (ordered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "ol") last.items.push(ordered[1]!);
      else blocks.push({ type: "ol", items: [ordered[1]!] });
    } else if (bullet) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.items.push(bullet[1]!);
      else blocks.push({ type: "ul", items: [bullet[1]!] });
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

/** Handles **bold** then tel: linking within each text run. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      return (
        <strong key={i} className="font-semibold">
          {linkifyPhones(bold[1]!)}
        </strong>
      );
    }
    return <Fragment key={i}>{linkifyPhones(part)}</Fragment>;
  });
}

/** Turns standalone 3–4 digit helpline numbers into tap-to-call links. */
function linkifyPhones(text: string): ReactNode {
  const parts = text.split(/(\b\d{3,4}\b)/g);
  return parts.map((part, i) => {
    if (HELPLINE_NUMBERS.has(part)) {
      return (
        <a
          key={i}
          href={`tel:${part}`}
          className="font-mono font-medium text-primary-ink underline decoration-primary-ink/40 underline-offset-2 hover:decoration-primary-ink"
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
