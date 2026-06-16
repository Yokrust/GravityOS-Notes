import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code2,
  CodeXml,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  Link2,
  Minus,
  Quote,
  RemoveFormatting,
  SlidersHorizontal,
  Strikethrough,
  Table as TableIcon,
  TextAlignJustify,
  Trash2,
  Type,
  Underline,
  Video,
  Rows3
} from "lucide-react";
import hljs from "highlight.js/lib/common";
import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AnimatePresence, motion } from "framer-motion";

import { ASSET_DND_MIME, type AssetDragPayload } from "../lib/media-kind.js";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

export type BlockType =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "todo"
  | "code"
  | "divider"
  | "image"
  | "video"
  | "table";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  language?: string | undefined;
  rows?: string[][];
  alt?: string;
  source?: string;
  width?: number;
  alignment?: MediaAlignment;
  mediaGroup?: string;
  mediaWrap?: MediaWrap;
  textAlignment?: TextAlignment;
}

export type MediaAlignment = "left" | "center" | "right";
export type MediaWrap = "none" | "left" | "right";
export type TextAlignment = "left" | "center" | "right" | "justify";

export type PastedNoteImage =
  | {
      bytes: Uint8Array;
      fileName: string;
      kind: "bytes";
      mimeType: string;
    }
  | { kind: "url"; source: string };

const emptyBlock = (type: BlockType = "p"): Block => {
  if (type === "divider") return { id: uid(), type, text: "" };
  if (type === "table") {
    return {
      id: uid(),
      type,
      text: "",
      rows: [
        ["", ""],
        ["", ""]
      ]
    };
  }
  if (type === "todo") return { id: uid(), type, text: "", checked: false };
  return { id: uid(), type, text: "" };
};

export function parseMarkdown(src: string): Block[] {
  if (!src.trim()) return [emptyBlock()];
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    if (rawLine === undefined) break;

    const image = rawLine.match(
      /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{width=(\d+)%(?:\s+align=(left|center|right))?(?:\s+wrap=(none|left|right))?(?:\s+group=([a-zA-Z0-9_-]+))?\})?$/
    );
    if (image) {
      blocks.push({
        alignment: normalizeMediaAlignment(image[4]),
        alt: image[1] ?? "",
        id: uid(),
        mediaWrap: normalizeMediaWrap(image[5]),
        ...(image[6] ? { mediaGroup: image[6] } : {}),
        source: image[2] ?? "",
        text: "",
        type: "image",
        width: normalizeMediaWidth(Number(image[3] ?? 100))
      });
      index += 1;
      continue;
    }

    const video = rawLine.match(
      /^\[Video(?:: ([^\]]+))?\]\(([^)\s]+)\)(?:\{width=(\d+)%(?:\s+align=(left|center|right))?(?:\s+wrap=(none|left|right))?(?:\s+group=([a-zA-Z0-9_-]+))?\})?$/i
    );
    if (video && normalizeVideoSource(video[2] ?? "")) {
      blocks.push({
        alignment: normalizeMediaAlignment(video[4]),
        alt: video[1] ?? "Video",
        id: uid(),
        mediaWrap: normalizeMediaWrap(video[5]),
        ...(video[6] ? { mediaGroup: video[6] } : {}),
        source: video[2] ?? "",
        text: "",
        type: "video",
        width: normalizeMediaWidth(Number(video[3] ?? 100))
      });
      index += 1;
      continue;
    }

    const { content: line, textAlignment } = parseTextAlignment(rawLine);
    const codeFence = line.match(/^```([A-Za-z0-9_+#.-]*)\s*$/);
    if (codeFence) {
      index += 1;
      const buffer: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
        buffer.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = normalizeCodeLanguage(codeFence[1] ?? "");
      blocks.push({
        id: uid(),
        type: "code",
        text: buffer.join("\n"),
        ...(language ? { language } : {})
      });
      continue;
    }

    if (
      /^\s*\|.+\|\s*$/.test(line) &&
      /^\s*\|.+\|\s*$/.test(lines[index + 1] ?? "")
    ) {
      const rows: string[][] = [];
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());

      rows.push(parseRow(line));
      index += 1;

      if (/^\s*\|[\s|:-]+\|\s*$/.test(lines[index] ?? "")) {
        index += 1;
      }

      while (
        index < lines.length &&
        /^\s*\|.+\|\s*$/.test(lines[index] ?? "")
      ) {
        rows.push(parseRow(lines[index] ?? ""));
        index += 1;
      }

      blocks.push({ id: uid(), type: "table", text: "", rows });
      continue;
    }

    if (/^\s*---\s*$/.test(line)) {
      blocks.push({ id: uid(), type: "divider", text: "" });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = (heading[1] ?? "").length as 1 | 2 | 3;
      blocks.push({
        id: uid(),
        type: `h${level}` as "h1" | "h2" | "h3",
        text: heading[2] ?? "",
        textAlignment
      });
      index += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      blocks.push({
        id: uid(),
        type: "quote",
        text: line.replace(/^>\s+/, ""),
        textAlignment
      });
      index += 1;
      continue;
    }

    const todo = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (todo) {
      blocks.push({
        id: uid(),
        type: "todo",
        text: todo[2] ?? "",
        checked: (todo[1] ?? "").toLowerCase() === "x",
        textAlignment
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        id: uid(),
        type: "bullet",
        text: line.replace(/^[-*]\s+/, ""),
        textAlignment
      });
      index += 1;
      continue;
    }

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    blocks.push({ id: uid(), type: "p", text: line, textAlignment });
    index += 1;
  }

  return ensureStructuralWritingBlocks(blocks);
}

export function inlineMarkdownToPlainText(value: string): string {
  return value
    .replace(
      /^!\[[^\]]*\]\([^)]+\)(?:\{width=\d+%(?:\s+align=(?:left|center|right))?(?:\s+wrap=(?:none|left|right))?(?:\s+group=[a-zA-Z0-9_-]+)?\})?$/gm,
      ""
    )
    .replace(
      /^\[Video(?:: [^\]]+)?\]\([^)]+\)(?:\{width=\d+%(?:\s+align=(?:left|center|right))?(?:\s+wrap=(?:none|left|right))?(?:\s+group=[a-zA-Z0-9_-]+)?\})?$/gim,
      ""
    )
    .replace(/\s*\{text-align=(?:left|center|right|justify)\}$/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/==\{(?:yellow|green|blue|pink|purple)\}(.+?)==/g, "$1")
    .replace(/==(.+?)==/g, "$1")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\+\+(.+?)\+\+/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

const INLINE_HIGHLIGHT_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "purple"
] as const;

type InlineHighlightColor = (typeof INLINE_HIGHLIGHT_COLORS)[number];

const escapeInlineHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export function normalizeInlineLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function renderInlineMarkdown(value: string): string {
  const placeholders: string[] = [];
  const hold = (html: string) => {
    const token = `\uE000${placeholders.length}\uE001`;
    placeholders.push(html);
    return token;
  };

  let html = value
    .replace(/`([^`\n]+)`/g, (_, code: string) =>
      hold(`<code>${escapeInlineHtml(code)}</code>`)
    )
    .replace(
      /\[([^\]\n]+)\]\(([^)\n]+)\)/g,
      (_, label: string, rawUrl: string) => {
        const url = normalizeInlineLink(rawUrl);
        return url
          ? hold(
              `<a href="${escapeInlineHtml(url)}" rel="noreferrer">${renderInlineMarkdown(label)}</a>`
            )
          : `${label} (${rawUrl})`;
      }
    );

  html = escapeInlineHtml(html)
    .replace(
      /==\{(yellow|green|blue|pink|purple)\}(.+?)==/g,
      '<mark data-highlight="$1">$2</mark>'
    )
    .replace(/==(.+?)==/g, '<mark data-highlight="yellow">$1</mark>')
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\+\+(.+?)\+\+/g, "<u>$1</u>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>");

  return html.replace(/\uE000(\d+)\uE001/g, (_, index: string) => {
    return placeholders[Number(index)] ?? "";
  });
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }
  if (!(node instanceof HTMLElement)) return "";

  const content = Array.from(node.childNodes).map(serializeInlineNode).join("");
  switch (node.tagName) {
    case "BR":
      return "\n";
    case "B":
    case "STRONG":
      return `**${content}**`;
    case "I":
    case "EM":
      return `*${content}*`;
    case "U":
      return `++${content}++`;
    case "S":
    case "STRIKE":
    case "DEL":
      return `~~${content}~~`;
    case "CODE":
      return `\`${inlineMarkdownToPlainText(content)}\``;
    case "A": {
      const url = normalizeInlineLink(node.getAttribute("href") ?? "");
      return url ? `[${content}](${url})` : content;
    }
    case "MARK": {
      const color = node.dataset.highlight;
      return color &&
        INLINE_HIGHLIGHT_COLORS.includes(color as InlineHighlightColor)
        ? `=={${color}}${content}==`
        : `==${content}==`;
    }
    case "DIV":
    case "P":
      return `${content}\n`;
    default:
      return content;
  }
}

export function serializeInlineContent(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .map(serializeInlineNode)
    .join("")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n$/, "");
}

type InlineFormat =
  | "bold"
  | "code"
  | "italic"
  | "link"
  | "strike"
  | "underline";

interface InlineSelectionState {
  alignment: TextAlignment;
  blockId: string;
  formats: InlineFormat[];
  rect: { bottom: number; left: number; top: number; width: number };
}

function elementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

function closestInlineElement(
  range: Range,
  editor: HTMLElement,
  selector: string
): HTMLElement | null {
  const element = elementFromNode(range.commonAncestorContainer);
  const match = element?.closest<HTMLElement>(selector) ?? null;
  return match && editor.contains(match) ? match : null;
}

function replaceRangeSelection(range: Range, node: Node) {
  range.deleteContents();
  range.insertNode(node);
  const nextRange = document.createRange();
  nextRange.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(nextRange);
  return nextRange;
}

function unwrapInlineElement(element: HTMLElement): Range | null {
  const parent = element.parentNode;
  const first = element.firstChild;
  const last = element.lastChild;
  if (!parent || !first || !last) return null;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();

  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}

function toggleInlineElement(
  range: Range,
  editor: HTMLElement,
  tagName: "code"
): Range | null {
  const existing = closestInlineElement(range, editor, tagName);
  if (existing) return unwrapInlineElement(existing);

  const wrapper = document.createElement(tagName);
  wrapper.append(range.extractContents());
  return replaceRangeSelection(range, wrapper);
}

function applyHighlight(
  range: Range,
  editor: HTMLElement,
  color: InlineHighlightColor | null
): Range | null {
  const existing = closestInlineElement(range, editor, "mark");
  if (!color) return existing ? unwrapInlineElement(existing) : range;
  if (existing) {
    existing.dataset.highlight = color;
    return range;
  }

  const mark = document.createElement("mark");
  mark.dataset.highlight = color;
  mark.append(range.extractContents());
  return replaceRangeSelection(range, mark);
}

export function serializeBlocks(blocks: Block[]): string {
  const output: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "p":
        output.push(`${block.text}${serializeTextAlignment(block)}`, "");
        break;
      case "h1":
        output.push(`# ${block.text}${serializeTextAlignment(block)}`, "");
        break;
      case "h2":
        output.push(`## ${block.text}${serializeTextAlignment(block)}`, "");
        break;
      case "h3":
        output.push(`### ${block.text}${serializeTextAlignment(block)}`, "");
        break;
      case "quote":
        output.push(`> ${block.text}${serializeTextAlignment(block)}`, "");
        break;
      case "bullet":
        output.push(`- ${block.text}${serializeTextAlignment(block)}`);
        break;
      case "todo":
        output.push(
          `- [${block.checked ? "x" : " "}] ${block.text}${serializeTextAlignment(block)}`
        );
        break;
      case "code":
        output.push(`\`\`\`${block.language ?? ""}`, block.text, "```", "");
        break;
      case "divider":
        output.push("---", "");
        break;
      case "image":
        output.push(
          `![${escapeMediaLabel(block.alt ?? "")}](${block.source ?? ""})${serializeMediaAttributes(block)}`,
          ""
        );
        break;
      case "video": {
        const video = normalizeVideoSource(block.source ?? "");
        output.push(
          `[Video: ${escapeMediaLabel(video?.provider ?? block.alt ?? "Video")}](${block.source ?? ""})${serializeMediaAttributes(block)}`,
          ""
        );
        break;
      }
      case "table": {
        const rows = block.rows ?? [["", ""]];
        const width = rows[0]?.length ?? 2;
        output.push(`| ${rows[0]?.map((cell) => cell || " ").join(" | ")} |`);
        output.push(`| ${Array(width).fill("---").join(" | ")} |`);
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
          output.push(
            `| ${rows[rowIndex]?.map((cell) => cell || " ").join(" | ")} |`
          );
        }
        output.push("");
        break;
      }
    }
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function replaceBlockWithDivider(
  blocks: Block[],
  id: string,
  trailingBlock: Block
): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return blocks;

  const divider: Block = {
    id,
    type: "divider",
    text: ""
  };

  return [
    ...blocks.slice(0, index),
    divider,
    trailingBlock,
    ...blocks.slice(index + 1)
  ];
}

export function replaceBlockWithTable(
  blocks: Block[],
  id: string,
  table: Block,
  leadingBlock: Block,
  trailingBlock: Block
): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return blocks;

  const previous = blocks[index - 1];
  const next = blocks[index + 1];
  return [
    ...blocks.slice(0, index),
    ...(previous && !isStructuralBlock(previous) ? [] : [leadingBlock]),
    { ...table, id },
    ...(next && !isStructuralBlock(next) ? [] : [trailingBlock]),
    ...blocks.slice(index + 1)
  ];
}

export function replaceBlockWithMedia(
  blocks: Block[],
  id: string,
  media: Block
): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return blocks;
  return ensureStructuralWritingBlocks([
    ...blocks.slice(0, index),
    { ...media, id },
    ...blocks.slice(index + 1)
  ]);
}

export function ensureStructuralWritingBlocks(blocks: Block[]): Block[] {
  if (!blocks.length) return [emptyBlock()];

  const next: Block[] = [];
  for (const block of blocks) {
    const previous = next.at(-1);
    const continuesMediaGroup =
      isMediaBlock(block) &&
      isMediaBlock(previous) &&
      Boolean(block.mediaGroup) &&
      block.mediaGroup === previous?.mediaGroup;
    if (
      isStructuralBlock(block) &&
      !continuesMediaGroup &&
      (next.length === 0 || isStructuralBlock(previous))
    ) {
      next.push(emptyBlock());
    }
    next.push(block);
  }
  if (isStructuralBlock(next.at(-1))) next.push(emptyBlock());
  return next;
}

export type MediaInserterPosition = "after" | "before" | "between";

export function getMediaInserterPosition(
  blocks: Block[],
  index: number
): MediaInserterPosition | null {
  const block = blocks[index];
  if (block?.type !== "p" || block.text.trim()) return null;

  // Any structural block (code, table, divider, image, video) gets the same
  // collapsed "click to keep writing" strip on its empty neighbours.
  const hasStructuralBefore = isStructuralBlock(blocks[index - 1]);
  const hasStructuralAfter = isStructuralBlock(blocks[index + 1]);
  if (hasStructuralBefore && hasStructuralAfter) return "between";
  if (hasStructuralBefore) return "after";
  if (hasStructuralAfter) return "before";
  return null;
}

const PASTED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function normalizePastedImageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const IMAGE_URL_PATTERN = /\.(?:gif|jpe?g|png|webp|avif)(?:[?#].*)?$/i;

function imageFileFromTransfer(data: DataTransfer): File | null {
  const directFile = Array.from(data.files ?? []).find((candidate) =>
    PASTED_IMAGE_TYPES.has(candidate.type.toLowerCase())
  );
  if (directFile) return directFile;

  // Images copied from a browser frequently arrive as a clipboard/drag *item*
  // (kind="file") rather than in `files`. `getAsFile` must run synchronously
  // while the originating paste/drop event is still being handled.
  for (const item of Array.from(data.items ?? [])) {
    if (
      item.kind === "file" &&
      PASTED_IMAGE_TYPES.has(item.type.toLowerCase())
    ) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

export function clipboardImageSource(data: DataTransfer): File | string | null {
  // Real bytes first: works offline and avoids CORS/hotlink failures.
  const file = imageFileFromTransfer(data);
  if (file) return file;

  const html = data.getData("text/html");
  if (html) {
    const source =
      (typeof DOMParser !== "undefined"
        ? new DOMParser()
            .parseFromString(html, "text/html")
            .querySelector("img[src]")
            ?.getAttribute("src")
        : null) ??
      // Fallback for environments without DOMParser (and as a safety net).
      html.match(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (source) return source;
  }

  // `text/uri-list` is the canonical payload when dragging an image out of a
  // browser (e.g. Pinterest); fall back to `text/plain` for plain links.
  const candidates = [
    ...data.getData("text/uri-list").split(/\r?\n/),
    data.getData("text/plain")
  ]
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("#"));
  for (const candidate of candidates) {
    if (
      candidate.startsWith("data:image/") ||
      IMAGE_URL_PATTERN.test(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

export function dataTransferHasImage(data: DataTransfer | null): boolean {
  if (!data) return false;
  const types = Array.from(data.types ?? []);
  // Only claim drags that carry a file or an external URL. Plain/rich text
  // drags (e.g. moving a selection inside the editor) are intentionally left
  // to the browser so internal text drag-and-drop keeps working.
  return types.includes("Files") || types.includes("text/uri-list");
}

async function readPastedImage(
  source: File | string
): Promise<PastedNoteImage | null> {
  if (source instanceof File) {
    return {
      bytes: new Uint8Array(await source.arrayBuffer()),
      fileName: source.name || "imagen",
      kind: "bytes",
      mimeType: source.type
    };
  }
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!match || !PASTED_IMAGE_TYPES.has(match[1]?.toLowerCase() ?? "")) {
      return null;
    }
    const decoded = match[2]
      ? atob(match[3] ?? "")
      : decodeURIComponent(match[3] ?? "");
    return {
      bytes: Uint8Array.from(decoded, (character) => character.charCodeAt(0)),
      fileName: "imagen",
      kind: "bytes",
      mimeType: match[1] ?? ""
    };
  }
  const url = normalizePastedImageUrl(source);
  return url ? { kind: "url", source: url } : null;
}

export function deleteEmptyBlock(
  blocks: Block[],
  id: string,
  fallbackBlock: Block
): { blocks: Block[]; focusId: string | null } {
  const index = blocks.findIndex((block) => block.id === id);
  if (index < 0) return { blocks, focusId: null };

  const previous = blocks[index - 1];
  if (previous?.type === "divider" || previous?.type === "table") {
    return {
      blocks: [...blocks.slice(0, index - 1), ...blocks.slice(index)],
      focusId: id
    };
  }

  const next = [...blocks.slice(0, index), ...blocks.slice(index + 1)];
  if (!next.length) next.push(fallbackBlock);
  return {
    blocks: next,
    focusId: next[Math.max(0, index - 1)]?.id ?? null
  };
}

function isStructuralBlock(block: Block | undefined): boolean {
  return (
    block?.type === "code" ||
    block?.type === "divider" ||
    block?.type === "image" ||
    block?.type === "table" ||
    block?.type === "video"
  );
}

type MediaBlockValue = Block & { type: "image" | "video" };

function isMediaBlock(block: Block | undefined): block is MediaBlockValue {
  return block?.type === "image" || block?.type === "video";
}

const MEDIA_GROUP_MAX_ITEMS = 4;
const MEDIA_GROUP_MIN_WIDTH = 12;
const MEDIA_WRAP_DEFAULT_WIDTH = 48;

export function isWrappableTextBlock(block: Block | undefined): boolean {
  return !!block && !isStructuralBlock(block) && block.text.trim().length > 0;
}

// Dropping a media block onto a text block anchors the media just before that
// block and turns on side wrapping, so the float engine flows the text around
// it (Word-style "square" wrap, anchored to one side).
export function anchorMediaToBlock(
  blocks: Block[],
  mediaId: string,
  targetId: string,
  side: "left" | "right"
): Block[] {
  if (mediaId === targetId) return blocks;
  const media = blocks.find((block) => block.id === mediaId);
  const target = blocks.find((block) => block.id === targetId);
  if (!isMediaBlock(media) || !isWrappableTextBlock(target)) return blocks;

  const wrapped: Block = {
    ...makeStandaloneMediaBlock(media),
    alignment: side,
    mediaWrap: side,
    width:
      media.width && media.width < 100 ? media.width : MEDIA_WRAP_DEFAULT_WIDTH
  };

  const next = blocks.filter((block) => block.id !== mediaId);
  const targetIndex = next.findIndex((block) => block.id === targetId);
  if (targetIndex < 0) return blocks;
  next.splice(targetIndex, 0, wrapped);

  return ensureStructuralWritingBlocks(normalizeMediaGroups(next));
}

export function groupMediaBlocks(
  blocks: Block[],
  sourceId: string,
  targetId: string,
  side: "left" | "right",
  groupId: string
): Block[] {
  if (sourceId === targetId) return blocks;
  const source = blocks.find((block) => block.id === sourceId);
  const target = blocks.find((block) => block.id === targetId);
  if (!isMediaBlock(source) || !isMediaBlock(target)) return blocks;

  const targetMembers = target.mediaGroup
    ? blocks.filter((block) => block.mediaGroup === target.mediaGroup)
    : [target];
  if (
    !targetMembers.some((block) => block.id === sourceId) &&
    targetMembers.length >= MEDIA_GROUP_MAX_ITEMS
  ) {
    return blocks;
  }

  const next = blocks.filter((block) => block.id !== sourceId);
  const targetIndex = next.findIndex((block) => block.id === targetId);
  if (targetIndex < 0) return blocks;
  next.splice(targetIndex + (side === "right" ? 1 : 0), 0, source);

  const activeGroup = target.mediaGroup ?? groupId;
  const memberIds = new Set(
    next
      .filter(
        (block) =>
          block.id === sourceId ||
          block.id === targetId ||
          block.mediaGroup === activeGroup
      )
      .map((block) => block.id)
  );
  const equalWidth = 100 / memberIds.size;

  const sourceGroup = source.mediaGroup;
  const sourceGroupRemaining = sourceGroup
    ? next.filter((block) => block.mediaGroup === sourceGroup)
    : [];

  return ensureStructuralWritingBlocks(
    normalizeMediaGroups(
      next.map((block) => {
        if (memberIds.has(block.id)) {
          return {
            ...block,
            alignment: "center",
            mediaGroup: activeGroup,
            mediaWrap: "none",
            width: equalWidth
          };
        }
        if (
          sourceGroup &&
          sourceGroup !== activeGroup &&
          sourceGroupRemaining.length === 1 &&
          block.id === sourceGroupRemaining[0]?.id
        ) {
          return makeStandaloneMediaBlock(block);
        }
        return block;
      })
    )
  );
}

export function resizeMediaGroupWidths(
  widths: number[],
  activeIndex: number,
  targetWidth: number
): number[] {
  if (widths.length < 2 || activeIndex < 0 || activeIndex >= widths.length) {
    return widths;
  }
  const maximum = 100 - MEDIA_GROUP_MIN_WIDTH * (widths.length - 1);
  const activeWidth = clamp(targetWidth, MEDIA_GROUP_MIN_WIDTH, maximum);
  const remaining = 100 - activeWidth;
  const otherTotal = widths.reduce(
    (sum, width, index) => sum + (index === activeIndex ? 0 : width),
    0
  );
  const next = widths.map((width, index) =>
    index === activeIndex
      ? activeWidth
      : otherTotal > 0
        ? (width / otherTotal) * remaining
        : remaining / (widths.length - 1)
  );

  let deficit = 0;
  for (let index = 0; index < next.length; index += 1) {
    if (index !== activeIndex && (next[index] ?? 0) < MEDIA_GROUP_MIN_WIDTH) {
      deficit += MEDIA_GROUP_MIN_WIDTH - (next[index] ?? 0);
      next[index] = MEDIA_GROUP_MIN_WIDTH;
    }
  }
  next[activeIndex] = Math.max(
    MEDIA_GROUP_MIN_WIDTH,
    (next[activeIndex] ?? activeWidth) - deficit
  );
  return next;
}

function makeStandaloneMediaBlock(block: Block): Block {
  const standalone = { ...block };
  delete standalone.mediaGroup;
  return { ...standalone, width: 100 };
}

function normalizeMediaGroups(blocks: Block[]): Block[] {
  const groups = new Map<string, Block[]>();
  for (const block of blocks) {
    if (block.mediaGroup) {
      const members = groups.get(block.mediaGroup) ?? [];
      members.push(block);
      groups.set(block.mediaGroup, members);
    }
  }

  return blocks.map((block) => {
    if (!block.mediaGroup) return block;
    const members = groups.get(block.mediaGroup) ?? [];
    if (members.length <= 1) {
      return makeStandaloneMediaBlock(block);
    }
    const total = members.reduce(
      (sum, member) => sum + (member.width ?? 100 / members.length),
      0
    );
    return {
      ...block,
      width:
        total > 0
          ? ((block.width ?? 100 / members.length) / total) * 100
          : 100 / members.length
    };
  });
}

export function normalizeMediaWidth(value: number): number {
  return Math.round(clampMediaWidth(value));
}

export function clampMediaWidth(value: number): number {
  return clamp(value, 25, 100);
}

export function normalizeMediaAlignment(
  value: string | undefined
): MediaAlignment {
  return value === "left" || value === "right" ? value : "center";
}

export function normalizeMediaWrap(value: string | undefined): MediaWrap {
  return value === "left" || value === "right" ? value : "none";
}

export function normalizeTextAlignment(
  value: string | undefined
): TextAlignment {
  return value === "center" || value === "right" || value === "justify"
    ? value
    : "left";
}

function parseTextAlignment(line: string): {
  content: string;
  textAlignment: TextAlignment;
} {
  const match = line.match(
    /^(.*?)(?:\s+\{text-align=(left|center|right|justify)\})$/
  );
  return {
    content: match?.[1] ?? line,
    textAlignment: normalizeTextAlignment(match?.[2])
  };
}

function serializeTextAlignment(block: Block): string {
  const alignment = normalizeTextAlignment(block.textAlignment);
  return alignment === "left" ? "" : ` {text-align=${alignment}}`;
}

export function resolveMediaDragWidth({
  alignment,
  containerWidth,
  edge,
  pointerX,
  startPointerX,
  startWidth
}: {
  alignment: MediaAlignment;
  containerWidth: number;
  edge: "left" | "right";
  pointerX: number;
  startPointerX: number;
  startWidth: number;
}): number {
  if (containerWidth <= 0) return clampMediaWidth(startWidth);
  const delta =
    edge === "left" ? startPointerX - pointerX : pointerX - startPointerX;
  const movementScale = alignment === "center" ? 2 : 1;
  return clampMediaWidth(
    startWidth + (delta / containerWidth) * 100 * movementScale
  );
}

function serializeMediaAttributes(block: Block): string {
  const alignment = normalizeMediaAlignment(block.alignment);
  const wrap = normalizeMediaWrap(block.mediaWrap);
  return `{width=${normalizeMediaWidth(block.width ?? 100)}%${
    alignment === "center" ? "" : ` align=${alignment}`
  }${wrap === "none" ? "" : ` wrap=${wrap}`}${
    block.mediaGroup ? ` group=${block.mediaGroup}` : ""
  }}`;
}

function escapeMediaLabel(value: string): string {
  return value.replace(/[[\]]/g, "").trim();
}

export interface VideoSource {
  embedUrl: string;
  kind: "direct" | "embed";
  provider: string;
}

export function normalizeVideoSource(value: string): VideoSource | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && isSafeVideoId(id)
        ? {
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
            kind: "embed",
            provider: "YouTube"
          }
        : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const id =
        url.searchParams.get("v") ??
        (["embed", "shorts"].includes(pathParts[0] ?? "")
          ? pathParts[1]
          : null);
      return id && isSafeVideoId(id)
        ? {
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
            kind: "embed",
            provider: "YouTube"
          }
        : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).at(-1);
      return id && /^\d+$/.test(id)
        ? {
            embedUrl: `https://player.vimeo.com/video/${id}`,
            kind: "embed",
            provider: "Vimeo"
          }
        : null;
    }
    if (host === "loom.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts.at(-1);
      return id && isSafeVideoId(id)
        ? {
            embedUrl: `https://www.loom.com/embed/${id}`,
            kind: "embed",
            provider: "Loom"
          }
        : null;
    }
    if (host === "dailymotion.com" || host === "dai.ly") {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = host === "dai.ly" ? parts[0] : parts.at(-1);
      return id && isSafeVideoId(id)
        ? {
            embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
            kind: "embed",
            provider: "Dailymotion"
          }
        : null;
    }
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) {
      return {
        embedUrl: url.toString(),
        kind: "direct",
        provider: "Video"
      };
    }
  } catch {
    return null;
  }
  return null;
}

function isSafeVideoId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

const TABLE_MIN_ROWS = 2;
const TABLE_MAX_ROWS = 12;
const TABLE_MIN_COLUMNS = 2;
const TABLE_MAX_COLUMNS = 8;
const TABLE_COLUMN_DRAG_STEP = 120;
const TABLE_ROW_DRAG_STEP = 38;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function resizeTableGrid(
  rows: string[][],
  targetRows: number,
  targetColumns: number
): string[][] {
  const rowCount = clamp(
    Math.round(targetRows),
    TABLE_MIN_ROWS,
    TABLE_MAX_ROWS
  );
  const columnCount = clamp(
    Math.round(targetColumns),
    TABLE_MIN_COLUMNS,
    TABLE_MAX_COLUMNS
  );

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from(
      { length: columnCount },
      (_, columnIndex) => rows[rowIndex]?.[columnIndex] ?? ""
    )
  );
}

export function resolveTableDragSize({
  deltaX,
  deltaY,
  startColumns,
  startRows
}: {
  deltaX: number;
  deltaY: number;
  startColumns: number;
  startRows: number;
}): { columns: number; rows: number } {
  return {
    columns: clamp(
      startColumns + Math.round(deltaX / TABLE_COLUMN_DRAG_STEP),
      TABLE_MIN_COLUMNS,
      TABLE_MAX_COLUMNS
    ),
    rows: clamp(
      startRows + Math.round(deltaY / TABLE_ROW_DRAG_STEP),
      TABLE_MIN_ROWS,
      TABLE_MAX_ROWS
    )
  };
}

export function moveBlockToIndex(
  blocks: Block[],
  blockId: string,
  targetIndex: number
): Block[] {
  const sourceIndex = blocks.findIndex((block) => block.id === blockId);
  if (sourceIndex < 0) return blocks;

  const boundedTarget = clamp(Math.round(targetIndex), 0, blocks.length);
  const insertionIndex =
    boundedTarget > sourceIndex ? boundedTarget - 1 : boundedTarget;
  if (insertionIndex === sourceIndex) return blocks;

  const next = [...blocks];
  const [movedBlock] = next.splice(sourceIndex, 1);
  if (!movedBlock) return blocks;
  next.splice(insertionIndex, 0, movedBlock);
  return next;
}

export function moveBlockWithWritingBoundaries(
  blocks: Block[],
  blockId: string,
  targetIndex: number
): Block[] {
  const source = blocks.find((block) => block.id === blockId);
  const detached = source?.mediaGroup
    ? normalizeMediaGroups(
        blocks.map((block) => {
          if (block.id !== blockId) return block;
          return makeStandaloneMediaBlock(block);
        })
      )
    : blocks;
  return ensureStructuralWritingBlocks(
    moveBlockToIndex(detached, blockId, targetIndex)
  );
}

interface EditorUnit {
  blocks: Array<{ block: Block; index: number }>;
  endIndex: number;
  key: string;
  startIndex: number;
}

export function buildEditorUnits(blocks: Block[]): EditorUnit[] {
  const units: EditorUnit[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) break;
    if (isMediaBlock(block) && block.mediaGroup) {
      const grouped: Array<{ block: Block; index: number }> = [];
      let cursor = index;
      while (
        cursor < blocks.length &&
        isMediaBlock(blocks[cursor]) &&
        blocks[cursor]?.mediaGroup === block.mediaGroup &&
        grouped.length < MEDIA_GROUP_MAX_ITEMS
      ) {
        const member = blocks[cursor];
        if (member) grouped.push({ block: member, index: cursor });
        cursor += 1;
      }
      if (grouped.length > 1) {
        units.push({
          blocks: grouped,
          endIndex: cursor,
          key: `media-group-${block.mediaGroup}`,
          startIndex: index
        });
        index = cursor;
        continue;
      }
    }

    units.push({
      blocks: [{ block, index }],
      endIndex: index + 1,
      key: block.id,
      startIndex: index
    });
    index += 1;
  }
  return units;
}

const CODE_LANGUAGE_OPTIONS = [
  { label: "Automático", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "HTML", value: "xml" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Bash", value: "bash" },
  { label: "SQL", value: "sql" },
  { label: "Java", value: "java" },
  { label: "C#", value: "csharp" },
  { label: "C++", value: "cpp" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "Markdown", value: "markdown" }
] as const;

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  c: "c",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml"
};

function normalizeCodeLanguage(language: string): string | undefined {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return undefined;
  return CODE_LANGUAGE_ALIASES[normalized] ?? normalized;
}

export function highlightCode(
  code: string,
  language?: string
): { html: string; language: string | null } {
  const normalizedLanguage = normalizeCodeLanguage(language ?? "");
  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return {
      html: hljs.highlight(code, {
        language: normalizedLanguage,
        ignoreIllegals: true
      }).value,
      language: normalizedLanguage
    };
  }

  const result = hljs.highlightAuto(code, [
    "javascript",
    "typescript",
    "python",
    "xml",
    "css",
    "json",
    "bash",
    "sql",
    "java",
    "csharp",
    "cpp",
    "rust",
    "go",
    "markdown"
  ]);
  return {
    html: result.value,
    language: result.language ?? null
  };
}

interface SlashOption {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  match: string[];
  apply: (block: Block) => Block;
}

const SLASH_OPTIONS: SlashOption[] = [
  {
    key: "p",
    label: "Texto",
    hint: "Párrafo simple",
    icon: <Type size={14} />,
    match: ["text", "texto", "parrafo", "párrafo", "p"],
    apply: (block) => ({ ...block, type: "p", text: "" })
  },
  {
    key: "h1",
    label: "Encabezado 1",
    hint: "Título principal",
    icon: <Heading1 size={14} />,
    match: ["h1", "heading1", "heading 1", "titulo", "título", "encabezado"],
    apply: (block) => ({ ...block, type: "h1", text: "" })
  },
  {
    key: "h2",
    label: "Encabezado 2",
    hint: "Sección",
    icon: <Heading2 size={14} />,
    match: ["h2", "heading2", "seccion", "sección"],
    apply: (block) => ({ ...block, type: "h2", text: "" })
  },
  {
    key: "h3",
    label: "Encabezado 3",
    hint: "Sub-sección",
    icon: <Heading3 size={14} />,
    match: ["h3", "heading3"],
    apply: (block) => ({ ...block, type: "h3", text: "" })
  },
  {
    key: "bullet",
    label: "Lista",
    hint: "Viñetas",
    icon: <List size={14} />,
    match: ["bullet", "list", "lista", "viñeta", "vinetas"],
    apply: (block) => ({ ...block, type: "bullet", text: "" })
  },
  {
    key: "todo",
    label: "Tarea",
    hint: "Casilla con texto",
    icon: <CheckSquare size={14} />,
    match: ["todo", "tarea", "check", "checkbox"],
    apply: (block) => ({ ...block, type: "todo", text: "", checked: false })
  },
  {
    key: "quote",
    label: "Cita",
    hint: "Frase destacada",
    icon: <Quote size={14} />,
    match: ["quote", "cita", "blockquote"],
    apply: (block) => ({ ...block, type: "quote", text: "" })
  },
  {
    key: "code",
    label: "Código",
    hint: "Bloque monoespaciado",
    icon: <Code2 size={14} />,
    match: ["code", "codigo", "código"],
    apply: (block) => ({ ...block, type: "code", text: "" })
  },
  {
    key: "divider",
    label: "Divisor",
    hint: "Línea horizontal",
    icon: <Minus size={14} />,
    match: ["divider", "divisor", "linea", "línea", "hr"],
    apply: (block) => ({ ...block, type: "divider", text: "" })
  },
  {
    key: "image",
    label: "Imagen",
    hint: "Archivo local redimensionable",
    icon: <ImageIcon size={14} />,
    match: ["image", "imagen", "foto", "picture", "gif", "gifs"],
    apply: (block) => ({
      ...block,
      alignment: "center",
      type: "image",
      text: "",
      width: 100
    })
  },
  {
    key: "video",
    label: "Video",
    hint: "YouTube, Vimeo, Loom y más",
    icon: <Video size={14} />,
    match: ["video", "youtube", "vimeo", "loom"],
    apply: (block) => ({
      ...block,
      alignment: "center",
      type: "video",
      text: "",
      width: 100
    })
  },
  {
    key: "table",
    label: "Tabla",
    hint: "2 × 2 editable",
    icon: <TableIcon size={14} />,
    match: ["table", "tabla"],
    apply: (block) => ({
      ...block,
      type: "table",
      text: "",
      rows: [
        ["", ""],
        ["", ""]
      ]
    })
  }
];

export function BlockEditor({
  importImagePath,
  loadImage,
  onChange,
  onChooseImage,
  onPasteImage,
  readTextAsset,
  value
}: {
  value: string;
  onChange: (next: string) => void;
  onChooseImage?: () => Promise<{ alt: string; source: string } | null>;
  onPasteImage?: (
    input: PastedNoteImage
  ) => Promise<{ alt: string; source: string }>;
  loadImage?: (
    source: string
  ) => Promise<{ bytes: Uint8Array; mimeType: string }>;
  /** Imports an in-notebook image file (dragged from the sidebar) into the note. */
  importImagePath?: (
    sourcePath: string
  ) => Promise<{ alt: string; source: string }>;
  /** Reads a dragged in-notebook text file's content (e.g. `.txt`). */
  readTextAsset?: (assetPath: string) => Promise<string>;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(value));
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const [slash, setSlash] = useState<{
    blockId: string;
    query: string;
    rect: { x: number; top: number; bottom: number };
  } | null>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const [inlineSelection, setInlineSelection] =
    useState<InlineSelectionState | null>(null);
  const [videoDialogBlockId, setVideoDialogBlockId] = useState<string | null>(
    null
  );
  const blockDragRef = useRef<BlockDragState | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inlineRangeRef = useRef<Range | null>(null);
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const trashZoneRef = useRef<HTMLDivElement | null>(null);
  const lastExternal = useRef(value);

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setBlocks(parseMarkdown(value));
    }
  }, [value]);

  useEffect(() => {
    const serialized = serializeBlocks(blocks);
    if (serialized !== lastExternal.current) {
      lastExternal.current = serialized;
      onChange(serialized);
    }
  }, [blocks, onChange]);

  useEffect(() => {
    if (!slash) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest("[data-slash-menu]") ||
        target.closest(`[data-editor-block-id="${CSS.escape(slash.blockId)}"]`)
      ) {
        return;
      }
      setSlash(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [slash]);

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block))
    );
  }, []);

  useEffect(() => {
    let animationFrame = 0;

    const syncSelection = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (
          inlineToolbarRef.current?.contains(
            document.activeElement as Node | null
          )
        ) {
          return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          inlineRangeRef.current = null;
          setInlineSelection(null);
          return;
        }

        const range = selection.getRangeAt(0);
        if (!range.toString().trim()) {
          inlineRangeRef.current = null;
          setInlineSelection(null);
          return;
        }

        const startEditor = elementFromNode(
          range.startContainer
        )?.closest<HTMLElement>("[data-inline-editor-id]");
        const endEditor = elementFromNode(
          range.endContainer
        )?.closest<HTMLElement>("[data-inline-editor-id]");
        if (
          !startEditor ||
          startEditor !== endEditor ||
          !editorRef.current?.contains(startEditor)
        ) {
          inlineRangeRef.current = null;
          setInlineSelection(null);
          return;
        }

        const bounds =
          range.getBoundingClientRect().width > 0
            ? range.getBoundingClientRect()
            : range.getClientRects()[0];
        if (!bounds) {
          inlineRangeRef.current = null;
          setInlineSelection(null);
          return;
        }

        const formats: InlineFormat[] = [];
        const formatSelectors: Array<[InlineFormat, string]> = [
          ["bold", "b, strong"],
          ["italic", "i, em"],
          ["underline", "u"],
          ["strike", "s, strike, del"],
          ["code", "code"],
          ["link", "a"]
        ];
        for (const [format, selector] of formatSelectors) {
          if (closestInlineElement(range, startEditor, selector)) {
            formats.push(format);
          }
        }

        inlineRangeRef.current = range.cloneRange();
        setInlineSelection({
          alignment: normalizeTextAlignment(startEditor.dataset.textAlignment),
          blockId: startEditor.dataset.inlineEditorId ?? "",
          formats,
          rect: {
            bottom: bounds.bottom,
            left: bounds.left,
            top: bounds.top,
            width: bounds.width
          }
        });
      });
    };

    const closeToolbar = (event: Event) => {
      if (inlineToolbarRef.current?.contains(event.target as Node | null)) {
        return;
      }
      inlineRangeRef.current = null;
      setInlineSelection(null);
    };

    document.addEventListener("selectionchange", syncSelection);
    document.addEventListener("scroll", closeToolbar, true);
    window.addEventListener("resize", closeToolbar);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("selectionchange", syncSelection);
      document.removeEventListener("scroll", closeToolbar, true);
      window.removeEventListener("resize", closeToolbar);
    };
  }, []);

  const applyInlineFormat = useCallback(
    (
      format:
        | InlineFormat
        | "alignment"
        | "clear"
        | "highlight"
        | "remove-highlight",
      value?: string
    ) => {
      const current = inlineSelection;
      const savedRange = inlineRangeRef.current;
      if (!current || !savedRange) return;

      const editor = Array.from(
        editorRef.current?.querySelectorAll<HTMLElement>(
          "[data-inline-editor-id]"
        ) ?? []
      ).find(
        (candidate) => candidate.dataset.inlineEditorId === current.blockId
      );
      if (!editor || !editor.contains(savedRange.commonAncestorContainer)) {
        return;
      }

      editor.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);

      let nextRange: Range | null = savedRange;
      if (format === "alignment") {
        const alignment = normalizeTextAlignment(value);
        updateBlock(current.blockId, { textAlignment: alignment });
        setInlineSelection((selectionState) =>
          selectionState ? { ...selectionState, alignment } : null
        );
      } else if (
        format === "bold" ||
        format === "italic" ||
        format === "underline" ||
        format === "strike"
      ) {
        const command =
          format === "strike"
            ? "strikeThrough"
            : format === "underline"
              ? "underline"
              : format;
        document.execCommand(command);
        nextRange =
          window.getSelection()?.rangeCount === 1
            ? (window.getSelection()?.getRangeAt(0).cloneRange() ?? savedRange)
            : savedRange;
      } else if (format === "code") {
        nextRange = toggleInlineElement(savedRange, editor, "code");
      } else if (format === "highlight") {
        const color = INLINE_HIGHLIGHT_COLORS.includes(
          value as InlineHighlightColor
        )
          ? (value as InlineHighlightColor)
          : "yellow";
        nextRange = applyHighlight(savedRange, editor, color);
      } else if (format === "remove-highlight") {
        nextRange = applyHighlight(savedRange, editor, null);
      } else if (format === "link") {
        const url = normalizeInlineLink(value ?? "");
        if (!url) return;
        document.execCommand("createLink", false, url);
        nextRange =
          window.getSelection()?.rangeCount === 1
            ? (window.getSelection()?.getRangeAt(0).cloneRange() ?? savedRange)
            : savedRange;
      } else if (format === "clear") {
        document.execCommand("removeFormat");
        document.execCommand("unlink");
        nextRange =
          window.getSelection()?.rangeCount === 1
            ? (window.getSelection()?.getRangeAt(0).cloneRange() ?? savedRange)
            : savedRange;
        for (const selector of ["mark", "code"]) {
          const customFormat: HTMLElement | null = nextRange
            ? closestInlineElement(nextRange, editor, selector)
            : null;
          if (customFormat) {
            nextRange = unwrapInlineElement(customFormat) ?? nextRange;
          }
        }
      }

      const markdown = serializeInlineContent(editor);
      editor.dataset.inlineMarkdown = markdown;
      updateBlock(current.blockId, { text: markdown });

      if (nextRange) {
        inlineRangeRef.current = nextRange.cloneRange();
        const bounds = nextRange.getBoundingClientRect();
        setInlineSelection((selectionState) =>
          selectionState
            ? {
                ...selectionState,
                rect: {
                  bottom: bounds.bottom,
                  left: bounds.left,
                  top: bounds.top,
                  width: bounds.width
                }
              }
            : null
        );
      }
    },
    [inlineSelection, updateBlock]
  );

  const insertAfter = useCallback((id: string, type: BlockType = "p") => {
    const nextBlock = emptyBlock(type);
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index < 0) return current;
      return [
        ...current.slice(0, index + 1),
        nextBlock,
        ...current.slice(index + 1)
      ];
    });
    setFocusRequest({ id: nextBlock.id });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index < 0) return current;
      const next = [...current.slice(0, index), ...current.slice(index + 1)];
      if (!next.length) next.push(emptyBlock());
      const target = isStructuralBlock(current[index])
        ? (next[index] ?? next[index - 1])
        : next[Math.max(0, index - 1)];
      if (target) setFocusRequest({ id: target.id });
      return ensureStructuralWritingBlocks(normalizeMediaGroups(next));
    });
  }, []);

  const moveBlock = useCallback((id: string, targetIndex: number) => {
    setBlocks((current) =>
      moveBlockWithWritingBoundaries(current, id, targetIndex)
    );
    setFocusRequest({ id });
  }, []);

  const updateBlockDrag = useCallback((next: BlockDragState | null) => {
    blockDragRef.current = next;
    setBlockDrag(next);
  }, []);

  const beginBlockDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      updateBlockDrag({
        active: false,
        blockId: block.id,
        dropIndex: null,
        label: getBlockLabel(block),
        mediaDrop: null,
        wrapDrop: null,
        overTrash: false,
        pointerId: event.pointerId,
        preview: getBlockPreview(block),
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY
      });
    },
    [updateBlockDrag]
  );

  useEffect(() => {
    if (!blockDrag) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const current = blockDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const distance = Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY
      );
      const active = current.active || distance >= 6;
      const trashBounds = trashZoneRef.current?.getBoundingClientRect();
      const overTrash =
        active &&
        Boolean(
          trashBounds &&
          event.clientX >= trashBounds.left &&
          event.clientX <= trashBounds.right &&
          event.clientY >= trashBounds.top &&
          event.clientY <= trashBounds.bottom
        );
      const editor = editorRef.current;
      const editorBounds = editor?.getBoundingClientRect();
      let dropIndex: number | null = null;
      let mediaDrop: BlockDragState["mediaDrop"] = null;
      let wrapDrop: BlockDragState["wrapDrop"] = null;

      if (
        active &&
        !overTrash &&
        editor &&
        editorBounds &&
        event.clientX >= editorBounds.left - 48 &&
        event.clientX <= editorBounds.right + 48 &&
        event.clientY >= editorBounds.top - 24 &&
        event.clientY <= editorBounds.bottom + 24
      ) {
        const sourceBlock = blocks.find(
          (block) => block.id === current.blockId
        );
        const pointedMedia = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-media-block-id]");
        const targetId = pointedMedia?.dataset.mediaBlockId;
        const targetBlock = blocks.find((block) => block.id === targetId);
        const targetGroupSize = targetBlock?.mediaGroup
          ? blocks.filter(
              (block) => block.mediaGroup === targetBlock.mediaGroup
            ).length
          : 1;
        if (
          isMediaBlock(sourceBlock) &&
          isMediaBlock(targetBlock) &&
          typeof targetId === "string" &&
          targetId !== current.blockId &&
          (sourceBlock?.mediaGroup === targetBlock?.mediaGroup ||
            targetGroupSize < MEDIA_GROUP_MAX_ITEMS)
        ) {
          const bounds = pointedMedia?.getBoundingClientRect();
          if (bounds) {
            mediaDrop = {
              side:
                event.clientX < bounds.left + bounds.width / 2
                  ? "left"
                  : "right",
              targetId
            };
          }
        }

        // Dropping a media block onto a text block wraps that text around it.
        if (isMediaBlock(sourceBlock) && !mediaDrop) {
          const pointedBlock = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>("[data-editor-block-id]");
          const wrapTargetId = pointedBlock?.dataset.editorBlockId;
          const wrapTarget = blocks.find((block) => block.id === wrapTargetId);
          if (
            pointedBlock &&
            typeof wrapTargetId === "string" &&
            wrapTargetId !== current.blockId &&
            isWrappableTextBlock(wrapTarget)
          ) {
            const bounds = pointedBlock.getBoundingClientRect();
            wrapDrop = {
              side:
                event.clientX < bounds.left + bounds.width / 2
                  ? "left"
                  : "right",
              targetId: wrapTargetId
            };
          }
        }

        const unitElements = Array.from(
          editor.querySelectorAll<HTMLElement>(":scope > [data-editor-unit]")
        );
        const candidateIndex = unitElements.findIndex((element) => {
          const bounds = element.getBoundingClientRect();
          return event.clientY < bounds.top + bounds.height / 2;
        });
        const nextIndex =
          candidateIndex < 0
            ? blocks.length
            : Number(unitElements[candidateIndex]?.dataset.startIndex ?? 0);
        const sourceIndex = blocks.findIndex(
          (block) => block.id === current.blockId
        );
        if (
          !mediaDrop &&
          !wrapDrop &&
          nextIndex !== sourceIndex &&
          nextIndex !== sourceIndex + 1
        ) {
          dropIndex = nextIndex;
        }
      }

      updateBlockDrag({
        ...current,
        active,
        dropIndex,
        mediaDrop,
        overTrash,
        wrapDrop,
        x: event.clientX,
        y: event.clientY
      });
    };

    const finishDrag = (event: PointerEvent) => {
      const current = blockDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (current.active && current.overTrash) {
        removeBlock(current.blockId);
      } else if (current.active && current.mediaDrop) {
        setBlocks((currentBlocks) =>
          groupMediaBlocks(
            currentBlocks,
            current.blockId,
            current.mediaDrop?.targetId ?? "",
            current.mediaDrop?.side ?? "right",
            `media-${uid()}`
          )
        );
      } else if (current.active && current.wrapDrop) {
        setBlocks((currentBlocks) =>
          anchorMediaToBlock(
            currentBlocks,
            current.blockId,
            current.wrapDrop?.targetId ?? "",
            current.wrapDrop?.side ?? "left"
          )
        );
      } else if (current.active && current.dropIndex !== null) {
        moveBlock(current.blockId, current.dropIndex);
      }
      updateBlockDrag(null);
    };

    const cancelDrag = () => updateBlockDrag(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("blur", cancelDrag);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("blur", cancelDrag);
    };
  }, [blockDrag?.pointerId, blocks, moveBlock, removeBlock, updateBlockDrag]);

  const removeEmptyBlock = useCallback((id: string) => {
    const fallbackBlock = emptyBlock();
    setSlash(null);
    setBlocks((current) => {
      const result = deleteEmptyBlock(current, id, fallbackBlock);
      if (result.focusId) setFocusRequest({ id: result.focusId });
      return ensureStructuralWritingBlocks(result.blocks);
    });
  }, []);

  const insertImportedImage = useCallback(
    (id: string, image: { alt: string; source: string }) => {
      setBlocks((current) => {
        if (!current.length) return current;
        // Drops can target a block that no longer exists (or the gap below the
        // last block); fall back to the final block so the media still lands.
        const requestedIndex = current.findIndex((block) => block.id === id);
        const targetIndex =
          requestedIndex < 0 ? current.length - 1 : requestedIndex;
        const target = current[targetIndex];
        const anchorId = target?.id ?? id;
        // Only consume an empty writing block (the "/image" slash flow); any
        // block that already holds content keeps it and the media lands after.
        const replaceTarget =
          !!target && !isStructuralBlock(target) && !target.text.trim();
        const mediaId = replaceTarget ? anchorId : uid();
        const media: Block = {
          alignment: "center",
          alt: image.alt,
          id: mediaId,
          source: image.source,
          text: "",
          type: "image",
          width: 100
        };
        const next = replaceTarget
          ? replaceBlockWithMedia(current, anchorId, media)
          : ensureStructuralWritingBlocks([
              ...current.slice(0, targetIndex + 1),
              media,
              ...current.slice(targetIndex + 1)
            ]);
        const mediaIndex = next.findIndex((block) => block.id === mediaId);
        const trailingBlock = next[mediaIndex + 1];
        if (trailingBlock) setFocusRequest({ id: trailingBlock.id });
        return next;
      });
      setSlash(null);
    },
    []
  );

  // Inserts dragged plain text (a `.txt` asset) as one paragraph per line,
  // preserving spacing. Mirrors `insertImportedImage`'s targeting rules.
  const insertTextBlocks = useCallback((id: string, text: string) => {
    const newBlocks: Block[] = text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line): Block => ({ id: uid(), text: line, type: "p" }));
    if (!newBlocks.length) return;
    setBlocks((current) => {
      if (!current.length) return current;
      const requestedIndex = current.findIndex((block) => block.id === id);
      const targetIndex =
        requestedIndex < 0 ? current.length - 1 : requestedIndex;
      const target = current[targetIndex];
      const replaceTarget =
        !!target && !isStructuralBlock(target) && !target.text.trim();
      const insertion = replaceTarget
        ? [
            ...current.slice(0, targetIndex),
            ...newBlocks,
            ...current.slice(targetIndex + 1)
          ]
        : [
            ...current.slice(0, targetIndex + 1),
            ...newBlocks,
            ...current.slice(targetIndex + 1)
          ];
      return ensureStructuralWritingBlocks(insertion);
    });
    const lastBlock = newBlocks[newBlocks.length - 1];
    if (lastBlock) setFocusRequest({ id: lastBlock.id });
    setSlash(null);
  }, []);

  const insertDivider = useCallback((id: string) => {
    const trailingBlock = emptyBlock();
    setBlocks((current) => replaceBlockWithDivider(current, id, trailingBlock));
    setSlash(null);
    setFocusRequest({ id: trailingBlock.id });
  }, []);

  const insertTable = useCallback((id: string) => {
    const table = emptyBlock("table");
    const leadingBlock = emptyBlock();
    const trailingBlock = emptyBlock();
    setBlocks((current) =>
      replaceBlockWithTable(current, id, table, leadingBlock, trailingBlock)
    );
    setSlash(null);
    setFocusRequest({ id });
  }, []);

  const insertImage = useCallback(
    async (id: string) => {
      const image = await onChooseImage?.();
      if (!image) {
        setSlash(null);
        setFocusRequest({ id });
        return;
      }
      insertImportedImage(id, image);
    },
    [insertImportedImage, onChooseImage]
  );

  // Shared image-insertion pipeline for both pasting and dropping. `targetId`
  // is the block the media should land on/after (focused block for paste, the
  // block under the pointer for drop); a missing id falls back to the end.
  const importTransferImage = useCallback(
    (targetId: string | null, data: DataTransfer): boolean => {
      if (!onPasteImage) return false;
      const source = clipboardImageSource(data);
      if (!source) return false;
      void readPastedImage(source)
        .then((input) => (input ? onPasteImage(input) : null))
        .then((image) => {
          if (image) insertImportedImage(targetId ?? "", image);
        })
        .catch(() => undefined);
      return true;
    },
    [insertImportedImage, onPasteImage]
  );

  const handleEditorPaste = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      const focusedId =
        (document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>(
              "[data-inline-editor-id]"
            )?.dataset.inlineEditorId
          : null) ?? null;
      if (importTransferImage(focusedId, event.clipboardData)) {
        event.preventDefault();
      }
    },
    [importTransferImage]
  );

  const handleEditorDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const targetId =
        document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-editor-block-id]")?.dataset
          .editorBlockId ?? null;

      // Assets dragged from the notebook sidebar (image -> import & embed,
      // text -> insert content) carry our custom payload.
      const assetRaw = event.dataTransfer.getData(ASSET_DND_MIME);
      if (assetRaw) {
        event.preventDefault();
        let payload: AssetDragPayload;
        try {
          payload = JSON.parse(assetRaw) as AssetDragPayload;
        } catch {
          return;
        }
        if (payload.mediaKind === "image" && importImagePath) {
          void importImagePath(payload.path)
            .then((image) => insertImportedImage(targetId ?? "", image))
            .catch(() => undefined);
        } else if (payload.mediaKind === "text" && readTextAsset) {
          void readTextAsset(payload.path)
            .then((text) => insertTextBlocks(targetId ?? "", text))
            .catch(() => undefined);
        }
        return;
      }

      if (!dataTransferHasImage(event.dataTransfer)) return;
      if (importTransferImage(targetId, event.dataTransfer)) {
        event.preventDefault();
      }
    },
    [
      importImagePath,
      importTransferImage,
      insertImportedImage,
      insertTextBlocks,
      readTextAsset
    ]
  );

  const handleEditorDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const hasAsset = event.dataTransfer.types.includes(ASSET_DND_MIME);
      if (!hasAsset && !dataTransferHasImage(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    []
  );

  const insertVideo = useCallback((id: string, source: string) => {
    const video = normalizeVideoSource(source);
    if (!video) return;
    setBlocks((current) => {
      const next = replaceBlockWithMedia(current, id, {
        alignment: "center",
        alt: video.provider,
        id,
        source,
        text: "",
        type: "video",
        width: 100
      });
      const mediaIndex = next.findIndex((block) => block.id === id);
      const trailingBlock = next[mediaIndex + 1];
      if (trailingBlock) setFocusRequest({ id: trailingBlock.id });
      return next;
    });
    setVideoDialogBlockId(null);
    setSlash(null);
  }, []);

  const changeType = useCallback((id: string, type: BlockType) => {
    setBlocks((current) =>
      // Re-run the structural guard so converting a block into code (now a
      // structural block) keeps writable paragraphs above and below it.
      ensureStructuralWritingBlocks(
        current.map((block) => {
          if (block.id !== id) return block;
          const option = SLASH_OPTIONS.find(
            (candidate) => candidate.key === type
          );
          return option ? option.apply(block) : { ...block, type };
        })
      )
    );
  }, []);

  const updateMediaBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((current) => {
      const target = current.find((block) => block.id === id);
      if (!target?.mediaGroup || patch.width === undefined) {
        const { width: patchWidth, ...rest } = patch;
        return current.map((block) =>
          block.id === id
            ? {
                ...block,
                ...rest,
                ...(patchWidth === undefined ? {} : { width: patchWidth })
              }
            : block
        );
      }

      const members = current.filter(
        (block) => block.mediaGroup === target.mediaGroup
      );
      const activeIndex = members.findIndex((block) => block.id === id);
      const widths = resizeMediaGroupWidths(
        members.map((block) => block.width ?? 100 / members.length),
        activeIndex,
        patch.width
      );
      const widthById = new Map(
        members.map((block, index) => [
          block.id,
          widths[index] ?? block.width ?? 100 / members.length
        ])
      );
      return current.map((block) =>
        block.mediaGroup === target.mediaGroup
          ? {
              ...block,
              ...(block.id === id ? patch : {}),
              width:
                widthById.get(block.id) ?? block.width ?? 100 / members.length
            }
          : block
      );
    });
  }, []);

  const editorUnits = useMemo(() => buildEditorUnits(blocks), [blocks]);

  const renderBlock = (
    block: Block,
    index: number,
    grouped: boolean,
    wrapped: boolean
  ): ReactNode => {
    const mediaInserterPosition = getMediaInserterPosition(blocks, index);
    return (
      <BlockFrame
        block={block}
        dropPosition={null}
        dragging={Boolean(blockDrag?.active && blockDrag.blockId === block.id)}
        grouped={grouped}
        key={block.id}
        mediaDropSide={
          blockDrag?.active && blockDrag.mediaDrop?.targetId === block.id
            ? blockDrag.mediaDrop.side
            : null
        }
        wrapDropSide={
          blockDrag?.active && blockDrag.wrapDrop?.targetId === block.id
            ? blockDrag.wrapDrop.side
            : null
        }
        mediaInserterPosition={mediaInserterPosition}
        onActivateInserter={(rect) => {
          setFocusRequest({ id: block.id });
          setSlash({
            blockId: block.id,
            query: "",
            rect: {
              bottom: rect.bottom,
              top: rect.top,
              x: rect.left
            }
          });
        }}
        onDragStart={(event) => beginBlockDrag(event, block)}
      >
        <BlockView
          block={block}
          focusRequest={focusRequest?.id === block.id ? focusRequest : null}
          grouped={grouped}
          wrapped={wrapped}
          onChangeType={(type) => changeType(block.id, type)}
          onCloseSlash={() => setSlash(null)}
          onFocusNext={() => {
            const nextBlock = blocks[index + 1];
            if (nextBlock) setFocusRequest({ id: nextBlock.id });
          }}
          onFocusPrev={() => {
            const previousBlock = blocks[index - 1];
            if (previousBlock) setFocusRequest({ id: previousBlock.id });
          }}
          onInsertAfter={(type) => insertAfter(block.id, type)}
          onInsertDivider={() => insertDivider(block.id)}
          onInsertTable={() => insertTable(block.id)}
          onOpenSlash={(query, rect) =>
            setSlash({ blockId: block.id, query, rect })
          }
          onRemove={() => removeBlock(block.id)}
          onRemoveEmpty={() => removeEmptyBlock(block.id)}
          onUpdate={(patch) =>
            isMediaBlock(block)
              ? updateMediaBlock(block.id, patch)
              : updateBlock(block.id, patch)
          }
          loadImage={loadImage}
          slashOpen={slash?.blockId === block.id}
        />
      </BlockFrame>
    );
  };

  return (
    <div
      className="block-editor-root relative"
      onDragOver={handleEditorDragOver}
      onDrop={handleEditorDrop}
      onPaste={handleEditorPaste}
      ref={editorRef}
    >
      {editorUnits.map((unit) => {
        const grouped = unit.blocks.length > 1;
        const onlyBlock = unit.blocks[0]?.block;
        const mediaWrap =
          !grouped && isMediaBlock(onlyBlock)
            ? normalizeMediaWrap(onlyBlock.mediaWrap)
            : "none";
        const clearsWrappedMedia =
          grouped ||
          (isStructuralBlock(onlyBlock) &&
            (!isMediaBlock(onlyBlock) || mediaWrap === "none"));
        const dropPosition =
          blockDrag?.active && blockDrag.dropIndex === unit.startIndex
            ? "before"
            : blockDrag?.active &&
                blockDrag.dropIndex === blocks.length &&
                unit.endIndex === blocks.length
              ? "after"
              : null;
        return (
          <div
            className={`editor-unit ${grouped ? "media-row" : ""} ${
              mediaWrap !== "none" ? `is-media-wrap is-wrap-${mediaWrap}` : ""
            } ${clearsWrappedMedia ? "is-wrap-boundary" : ""} ${
              dropPosition ? `is-drop-${dropPosition}` : ""
            }`}
            data-editor-unit
            data-start-index={unit.startIndex}
            key={unit.key}
            style={
              mediaWrap !== "none"
                ? {
                    width: `${normalizeMediaWidth(onlyBlock?.width ?? 100)}%`
                  }
                : undefined
            }
          >
            {unit.blocks.map(({ block, index }) =>
              renderBlock(block, index, grouped, mediaWrap !== "none")
            )}
          </div>
        );
      })}

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {slash ? (
                <SlashMenu
                  anchor={slash.rect}
                  onClose={() => setSlash(null)}
                  onSelect={(option) => {
                    const type = option.key as BlockType;
                    if (type === "divider") {
                      insertDivider(slash.blockId);
                    } else if (type === "table") {
                      insertTable(slash.blockId);
                    } else if (type === "image") {
                      void insertImage(slash.blockId);
                    } else if (type === "video") {
                      setVideoDialogBlockId(slash.blockId);
                      setSlash(null);
                    } else {
                      changeType(slash.blockId, type);
                      setSlash(null);
                      setFocusRequest({ id: slash.blockId });
                    }
                  }}
                  query={slash.query}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {videoDialogBlockId ? (
                <VideoDialog
                  onClose={() => {
                    setVideoDialogBlockId(null);
                    setFocusRequest({ id: videoDialogBlockId });
                  }}
                  onSubmit={(source) => insertVideo(videoDialogBlockId, source)}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {blockDrag?.active ? (
                <BlockDragOverlay
                  drag={blockDrag}
                  trashZoneRef={trashZoneRef}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {inlineSelection ? (
                <InlineFormattingToolbar
                  activeFormats={inlineSelection.formats}
                  alignment={inlineSelection.alignment}
                  anchor={inlineSelection.rect}
                  onFormat={applyInlineFormat}
                  toolbarRef={inlineToolbarRef}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}

interface BlockDragState {
  active: boolean;
  blockId: string;
  dropIndex: number | null;
  label: string;
  mediaDrop: {
    side: "left" | "right";
    targetId: string;
  } | null;
  wrapDrop: {
    side: "left" | "right";
    targetId: string;
  } | null;
  overTrash: boolean;
  pointerId: number;
  preview: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

function getBlockLabel(block: Block): string {
  const labels: Record<BlockType, string> = {
    bullet: "Lista",
    code: "Código",
    divider: "Divisor",
    h1: "Encabezado 1",
    h2: "Encabezado 2",
    h3: "Encabezado 3",
    image: "Imagen",
    p: "Texto",
    quote: "Cita",
    table: "Tabla",
    todo: "Tarea",
    video: "Video"
  };
  return labels[block.type];
}

function getBlockPreview(block: Block): string {
  if (block.type === "divider") return "Línea divisoria";
  if (block.type === "table") {
    const rows = block.rows?.length ?? TABLE_MIN_ROWS;
    const columns = block.rows?.[0]?.length ?? TABLE_MIN_COLUMNS;
    return `${rows} × ${columns}`;
  }
  if (block.type === "image") return block.alt || "Imagen";
  if (block.type === "video") {
    return normalizeVideoSource(block.source ?? "")?.provider ?? "Video";
  }
  return block.text.trim().slice(0, 64) || "Bloque vacío";
}

function BlockFrame({
  block,
  children,
  dropPosition,
  dragging,
  grouped,
  mediaDropSide,
  wrapDropSide,
  mediaInserterPosition,
  onActivateInserter,
  onDragStart
}: {
  block: Block;
  children: ReactNode;
  dropPosition: "after" | "before" | null;
  dragging: boolean;
  grouped: boolean;
  mediaDropSide: "left" | "right" | null;
  wrapDropSide: "left" | "right" | null;
  mediaInserterPosition: MediaInserterPosition | null;
  onActivateInserter: (rect: DOMRect) => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const isEmptyParagraph = block.type === "p" && !block.text.trim();
  const isHeading =
    block.type === "h1" || block.type === "h2" || block.type === "h3";

  return (
    <div
      className={`editor-block group/block ${
        dragging ? "is-dragging" : ""
      } ${dropPosition ? `is-drop-${dropPosition}` : ""} ${
        isEmptyParagraph ? "is-empty-paragraph" : ""
      } ${isHeading ? "is-heading" : ""} ${
        grouped ? "is-grouped-media" : ""
      } ${mediaDropSide ? `is-media-drop-${mediaDropSide}` : ""} ${
        wrapDropSide ? `is-wrap-drop-${wrapDropSide}` : ""
      }`}
      aria-label={
        mediaInserterPosition
          ? mediaInserterPosition === "before"
            ? "Escribir antes del bloque"
            : mediaInserterPosition === "after"
              ? "Escribir después del bloque"
              : "Escribir entre los bloques"
          : undefined
      }
      data-media-inserter={mediaInserterPosition ? "true" : undefined}
      data-media-inserter-position={mediaInserterPosition ?? undefined}
      data-editor-block-id={block.id}
      onClick={(event) => {
        if (!mediaInserterPosition) return;
        onActivateInserter(event.currentTarget.getBoundingClientRect());
      }}
      style={
        grouped
          ? {
              flexBasis: `${block.width ?? 100}%`
            }
          : undefined
      }
    >
      <button
        aria-label={`Arrastrar bloque: ${getBlockLabel(block)}`}
        className="editor-block__handle"
        onPointerDown={onDragStart}
        type="button"
      >
        <GripVertical aria-hidden="true" size={15} />
      </button>
      {children}
    </div>
  );
}

function BlockDragOverlay({
  drag,
  trashZoneRef
}: {
  drag: BlockDragState;
  trashZoneRef: { current: HTMLDivElement | null };
}) {
  return (
    <>
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="block-drag-ghost"
        initial={{ opacity: 0, scale: 0.96 }}
        style={{ left: drag.x + 16, top: drag.y + 16 }}
      >
        <GripVertical aria-hidden="true" size={15} />
        <span>
          <strong>{drag.label}</strong>
          <small>{drag.preview}</small>
        </span>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={`block-trash-zone ${drag.overTrash ? "is-over" : ""}`}
        initial={{ opacity: 0, y: 16 }}
        ref={trashZoneRef}
      >
        <Trash2 aria-hidden="true" size={18} />
        <span>
          {drag.overTrash
            ? "Suelta para eliminar"
            : "Arrastra aquí para eliminar"}
        </span>
      </motion.div>
    </>
  );
}

function InlineFormattingToolbar({
  activeFormats,
  alignment,
  anchor,
  onFormat,
  toolbarRef
}: {
  activeFormats: InlineFormat[];
  alignment: TextAlignment;
  anchor: { bottom: number; left: number; top: number; width: number };
  onFormat: (
    format:
      | InlineFormat
      | "alignment"
      | "clear"
      | "highlight"
      | "remove-highlight",
    value?: string
  ) => void;
  toolbarRef: { current: HTMLDivElement | null };
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("https://");
  const placeBelow = anchor.top < 156;
  const center = anchor.left + anchor.width / 2;
  const left = clamp(center, 178, window.innerWidth - 178);

  const submitLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = normalizeInlineLink(linkValue);
    if (!url) return;
    onFormat("link", url);
    setLinkOpen(false);
  };

  const formatButtons: Array<{
    format: InlineFormat | "clear";
    icon: ReactNode;
    label: string;
  }> = [
    { format: "bold", icon: <Bold size={17} />, label: "Negrita" },
    { format: "italic", icon: <Italic size={17} />, label: "Cursiva" },
    { format: "underline", icon: <Underline size={17} />, label: "Subrayado" },
    {
      format: "strike",
      icon: <Strikethrough size={17} />,
      label: "Tachado"
    },
    { format: "code", icon: <CodeXml size={17} />, label: "Código en línea" },
    {
      format: "clear",
      icon: <RemoveFormatting size={17} />,
      label: "Quitar formato"
    }
  ];

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className={`inline-format-toolbar ${placeBelow ? "is-below" : ""}`}
      initial={{ opacity: 0, scale: 0.97, y: placeBelow ? -4 : 4 }}
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          event.preventDefault();
        }
      }}
      ref={toolbarRef}
      style={{
        left,
        top: placeBelow ? anchor.bottom + 10 : anchor.top - 10
      }}
      transition={{ duration: 0.14 }}
    >
      <div className="inline-format-toolbar__actions">
        {formatButtons.slice(0, 4).map((button) => (
          <button
            aria-label={button.label}
            aria-pressed={
              button.format !== "clear" && activeFormats.includes(button.format)
            }
            className="inline-format-toolbar__button"
            key={button.format}
            onClick={() => onFormat(button.format)}
            title={button.label}
            type="button"
          >
            {button.icon}
          </button>
        ))}
        <button
          aria-label="Enlace"
          aria-pressed={activeFormats.includes("link")}
          className="inline-format-toolbar__button"
          onClick={() => setLinkOpen((current) => !current)}
          title="Enlace"
          type="button"
        >
          <Link2 size={17} />
        </button>
        {formatButtons.slice(4).map((button) => (
          <button
            aria-label={button.label}
            aria-pressed={
              button.format !== "clear" && activeFormats.includes(button.format)
            }
            className="inline-format-toolbar__button"
            key={button.format}
            onClick={() => onFormat(button.format)}
            title={button.label}
            type="button"
          >
            {button.icon}
          </button>
        ))}
      </div>

      <div className="inline-format-toolbar__highlights">
        <span title="Marcatexto">
          <Highlighter aria-hidden="true" size={15} />
        </span>
        {INLINE_HIGHLIGHT_COLORS.map((color) => (
          <button
            aria-label={`Marcatexto ${color}`}
            className="inline-format-toolbar__swatch"
            data-highlight={color}
            key={color}
            onClick={() => onFormat("highlight", color)}
            type="button"
          />
        ))}
        <button
          aria-label="Quitar marcatexto"
          className="inline-format-toolbar__swatch is-clear"
          onClick={() => onFormat("remove-highlight")}
          title="Quitar marcatexto"
          type="button"
        />
      </div>
      <div
        aria-label="Alinear texto"
        className="inline-format-toolbar__alignment"
        role="group"
      >
        {(
          [
            ["left", "Alinear texto a la izquierda", <AlignLeft key="left" />],
            ["center", "Centrar texto", <AlignCenter key="center" />],
            ["right", "Alinear texto a la derecha", <AlignRight key="right" />],
            ["justify", "Justificar texto", <TextAlignJustify key="justify" />]
          ] as const
        ).map(([value, label, icon]) => (
          <button
            aria-label={label}
            aria-pressed={alignment === value}
            className="inline-format-toolbar__button"
            key={value}
            onClick={() => onFormat("alignment", value)}
            title={label}
            type="button"
          >
            {icon}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {linkOpen ? (
          <motion.form
            animate={{ height: "auto", opacity: 1 }}
            className="inline-format-toolbar__link"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            onSubmit={submitLink}
          >
            <input
              aria-label="Dirección del enlace"
              autoFocus
              onChange={(event) => setLinkValue(event.target.value)}
              placeholder="https://..."
              value={linkValue}
            />
            <button type="submit">Aplicar</button>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function BlockView({
  block,
  focusRequest,
  grouped,
  loadImage,
  onChangeType,
  onCloseSlash,
  onFocusNext,
  onFocusPrev,
  onInsertAfter,
  onInsertDivider,
  onInsertTable,
  onOpenSlash,
  onRemove,
  onRemoveEmpty,
  onUpdate,
  slashOpen,
  wrapped
}: {
  block: Block;
  focusRequest: { id: string } | null;
  grouped: boolean;
  wrapped: boolean;
  loadImage:
    | ((source: string) => Promise<{ bytes: Uint8Array; mimeType: string }>)
    | undefined;
  onUpdate: (patch: Partial<Block>) => void;
  onInsertAfter: (type?: BlockType) => void;
  onInsertDivider: () => void;
  onInsertTable: () => void;
  onRemove: () => void;
  onRemoveEmpty: () => void;
  onChangeType: (type: BlockType) => void;
  onFocusPrev: () => void;
  onFocusNext: () => void;
  onOpenSlash: (
    query: string,
    rect: { x: number; top: number; bottom: number }
  ) => void;
  onCloseSlash: () => void;
  slashOpen: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.dataset.inlineMarkdown !== block.text) {
      element.innerHTML = renderInlineMarkdown(block.text);
      element.dataset.inlineMarkdown = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (focusRequest && ref.current) {
      ref.current.focus();
      placeCaretAtEnd(ref.current);
    }
  }, [focusRequest]);

  if (block.type === "divider") {
    return (
      <DividerBlock
        focusRequest={focusRequest}
        onFocusNext={onFocusNext}
        onFocusPrev={onFocusPrev}
        onRemove={onRemove}
      />
    );
  }

  if (block.type === "table") {
    return (
      <TableBlock
        block={block}
        focusRequest={focusRequest}
        onFocusNext={onFocusNext}
        onFocusPrev={onFocusPrev}
        onUpdate={onUpdate}
      />
    );
  }

  if (block.type === "image" || block.type === "video") {
    return (
      <MediaBlock
        block={block}
        focusRequest={focusRequest}
        grouped={grouped}
        loadImage={loadImage}
        onFocusNext={onFocusNext}
        onFocusPrev={onFocusPrev}
        onRemove={onRemove}
        onUpdate={onUpdate}
        wrapped={wrapped}
      />
    );
  }

  if (block.type === "code") {
    return (
      <CodeBlock
        block={block}
        focusRequest={focusRequest}
        onChangeType={onChangeType}
        onFocusNext={onFocusNext}
        onFocusPrev={onFocusPrev}
        onUpdate={onUpdate}
      />
    );
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const text = element.textContent ?? "";
    const markdown = serializeInlineContent(element);

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      element.dataset.inlineMarkdown = markdown;
      onUpdate({ text: markdown });

      if (
        (block.type === "h1" ||
          block.type === "h2" ||
          block.type === "h3" ||
          block.type === "quote" ||
          block.type === "code") &&
        !text
      ) {
        onChangeType("p");
        return;
      }

      if ((block.type === "bullet" || block.type === "todo") && !text) {
        onChangeType("p");
        return;
      }

      onInsertAfter(
        block.type === "bullet" || block.type === "todo" ? block.type : "p"
      );
      return;
    }

    if (event.key === "Backspace" && text === "" && !event.shiftKey) {
      event.preventDefault();
      if (block.type !== "p") {
        onChangeType("p");
      } else {
        onRemoveEmpty();
      }
      return;
    }

    if (event.key === "ArrowUp" && caretAtStart(element)) {
      event.preventDefault();
      onFocusPrev();
      return;
    }

    if (event.key === "ArrowDown" && caretAtEnd(element)) {
      event.preventDefault();
      onFocusNext();
      return;
    }

    if (event.key === "Escape" && slashOpen) {
      event.preventDefault();
      onCloseSlash();
    }
  };

  const handleInput = () => {
    const element = ref.current;
    if (!element) return;
    const text = element.textContent ?? "";
    const markdown = serializeInlineContent(element);
    element.dataset.inlineMarkdown = markdown;
    onUpdate({ text: markdown });

    if (block.type === "p") {
      const match = text.match(
        /^(#{1,3}|>|-|\*|\[\s*\]|\[\s*x\s*\]|```|---|\|)\s$/i
      );
      if (match) {
        const token = match[1];
        let nextType: BlockType | null = null;
        let checked: boolean | undefined;

        if (token === "#") nextType = "h1";
        else if (token === "##") nextType = "h2";
        else if (token === "###") nextType = "h3";
        else if (token === ">") nextType = "quote";
        else if (token === "-" || token === "*") nextType = "bullet";
        else if (/^\[\s*\]$/.test(token ?? "")) {
          nextType = "todo";
          checked = false;
        } else if (/^\[\s*x\s*\]$/i.test(token ?? "")) {
          nextType = "todo";
          checked = true;
        } else if (token === "```") nextType = "code";
        else if (token === "---") nextType = "divider";
        else if (token === "|") nextType = "table";

        if (nextType) {
          queueMicrotask(() => {
            if (nextType === "todo") {
              onUpdate({ checked: checked ?? false, text: "", type: nextType });
            } else {
              if (nextType === "divider") {
                onInsertDivider();
              } else if (nextType === "table") {
                onInsertTable();
              } else if (nextType === "code") {
                onChangeType("code");
              } else {
                onUpdate({ text: "", type: nextType });
              }
            }
          });
          return;
        }
      }
    }

    if (text.startsWith("/")) {
      const rect = element.getBoundingClientRect();
      onOpenSlash(text.slice(1), {
        bottom: rect.bottom,
        top: rect.top,
        x: rect.left
      });
    } else if (slashOpen) {
      onCloseSlash();
    }
  };

  const placeholder =
    block.type === "p"
      ? "Escribe '/' para comandos…"
      : block.type === "h1"
        ? "Encabezado 1"
        : block.type === "h2"
          ? "Encabezado 2"
          : block.type === "h3"
            ? "Encabezado 3"
            : block.type === "quote"
              ? "Cita…"
              : block.type === "bullet"
                ? "Elemento de lista"
                : block.type === "todo"
                  ? "Tarea"
                  : "Código";

  // Block typography (size, weight, leading, spacing, color) is owned by CSS in
  // `.note-editor-content [data-block-type=…]` — the single source of truth.
  // These classes carry only structural rhythm that CSS does not provide.
  const textClasses: Record<BlockType, string> = {
    p: "py-1",
    h1: "font-display",
    h2: "font-display",
    h3: "font-display",
    quote: "",
    bullet: "",
    todo: "",
    code: "font-mono",
    divider: "",
    image: "",
    video: "",
    table: ""
  };

  const editable = (
    <div
      className={`outline-none whitespace-pre-wrap break-words ${textClasses[block.type]}`}
      contentEditable
      data-inline-editor-id={block.id}
      data-block-type={block.type}
      data-placeholder={placeholder}
      data-text-alignment={normalizeTextAlignment(block.textAlignment)}
      onBlur={() => {
        const element = ref.current;
        if (!element) return;
        const markdown = serializeInlineContent(element);
        element.dataset.inlineMarkdown = markdown;
        onUpdate({ text: markdown });
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      ref={ref}
      style={{ textAlign: normalizeTextAlignment(block.textAlignment) }}
      suppressContentEditableWarning
    />
  );

  if (block.type === "bullet") {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 pl-1"
        initial={{ opacity: 0, y: 2 }}
        transition={{ duration: 0.18 }}
      >
        <span className="mt-[10px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--ink-2)]" />
        <div className="min-w-0 flex-1">{editable}</div>
      </motion.div>
    );
  }

  if (block.type === "todo") {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 pl-1 py-0.5"
        initial={{ opacity: 0, y: 2 }}
        transition={{ duration: 0.18 }}
      >
        <button
          className={`mt-[5px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[5px] border transition ${
            block.checked
              ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
              : "border-[color:var(--line-strong)] hover:border-[color:var(--accent)]"
          }`}
          onClick={() => onUpdate({ checked: !block.checked })}
          type="button"
        >
          {block.checked ? (
            <svg
              className="h-2.5 w-2.5 text-[color:var(--accent-ink)]"
              viewBox="0 0 12 12"
            >
              <path
                d="M2.5 6.2 L5 8.5 L9.5 3.8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ) : null}
        </button>
        <div
          className={`min-w-0 flex-1 ${
            block.checked ? "text-[color:var(--muted)] line-through" : ""
          }`}
        >
          {editable}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative"
      initial={{ opacity: 0, y: 2 }}
      transition={{ duration: 0.18 }}
    >
      {editable}
    </motion.div>
  );
}

function MediaBlock({
  block,
  focusRequest,
  grouped,
  loadImage,
  onFocusNext,
  onFocusPrev,
  onRemove,
  onUpdate,
  wrapped
}: {
  block: Block;
  focusRequest: { id: string } | null;
  grouped: boolean;
  loadImage:
    | ((source: string) => Promise<{ bytes: Uint8Array; mimeType: string }>)
    | undefined;
  onFocusNext: () => void;
  onFocusPrev: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Block>) => void;
  wrapped: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{
    containerWidth: number;
    edge: "left" | "right";
    frameId: number;
    latestWidth: number;
    pointerId: number;
    startPointerX: number;
    startWidth: number;
  } | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    right: number;
    top: number;
  } | null>(null);
  const width = normalizeMediaWidth(block.width ?? 100);
  const alignment = normalizeMediaAlignment(block.alignment);
  const mediaWrap = normalizeMediaWrap(block.mediaWrap);
  const video =
    block.type === "video" ? normalizeVideoSource(block.source ?? "") : null;

  useEffect(() => {
    if (focusRequest) ref.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (block.type !== "image" || !block.source) return;
    if (/^https:\/\//i.test(block.source)) {
      setImageUrl(block.source);
      setImageError(false);
      return;
    }
    if (!loadImage) {
      setImageError(true);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    void loadImage(block.source)
      .then((asset) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(
          new Blob([new Uint8Array(asset.bytes).buffer], {
            type: asset.mimeType
          })
        );
        setImageUrl(objectUrl);
        setImageError(false);
      })
      .catch(() => {
        if (active) setImageError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [block.source, block.type, loadImage]);

  const menuOpen = menuAnchor !== null;
  const toggleMenu = useCallback(() => {
    setMenuAnchor((current) => {
      if (current) return null;
      const rect = handleRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        right: Math.max(8, window.innerWidth - rect.right),
        top: rect.bottom + 6
      };
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("[data-media-menu]") ||
          target.closest("[data-media-handle]"))
      ) {
        return;
      }
      setMenuAnchor(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAnchor(null);
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!resizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      resizeRef.current?.edge === "left" ? "nesw-resize" : "nwse-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;
      resize.latestWidth = resolveMediaDragWidth({
        alignment,
        containerWidth: resize.containerWidth,
        edge: resize.edge,
        pointerX: event.clientX,
        startPointerX: resize.startPointerX,
        startWidth: resize.startWidth
      });
      cancelAnimationFrame(resize.frameId);
      resize.frameId = requestAnimationFrame(() => {
        if (wrapped) {
          const unit = ref.current?.closest<HTMLElement>(".editor-unit");
          if (unit) unit.style.width = `${resize.latestWidth}%`;
        } else if (grouped) {
          const frame = ref.current?.closest<HTMLElement>(".editor-block");
          if (frame) frame.style.flexBasis = `${resize.latestWidth}%`;
        } else if (ref.current) {
          ref.current.style.width = `${resize.latestWidth}%`;
        }
      });
    };
    const commitResize = (pointerId?: number) => {
      const resize = resizeRef.current;
      if (
        !resize ||
        (pointerId !== undefined && resize.pointerId !== pointerId)
      )
        return;
      cancelAnimationFrame(resize.frameId);
      const committedWidth = Math.round(resize.latestWidth);
      if (wrapped) {
        const unit = ref.current?.closest<HTMLElement>(".editor-unit");
        if (unit) unit.style.width = `${committedWidth}%`;
      } else if (grouped) {
        const frame = ref.current?.closest<HTMLElement>(".editor-block");
        if (frame) frame.style.flexBasis = `${committedWidth}%`;
      } else if (ref.current) {
        ref.current.style.width = `${committedWidth}%`;
      }
      resizeRef.current = null;
      setResizing(false);
      onUpdate({ width: committedWidth });
    };
    const finishResize = (event: PointerEvent) => commitResize(event.pointerId);
    const finishOnBlur = () => commitResize();

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    window.addEventListener("blur", finishOnBlur);
    return () => {
      const resize = resizeRef.current;
      if (resize) cancelAnimationFrame(resize.frameId);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.removeEventListener("blur", finishOnBlur);
    };
  }, [alignment, grouped, onUpdate, resizing, wrapped]);

  const mediaLabel = block.type === "image" ? "imagen" : "video";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`media-block is-${alignment} ${resizing ? "is-resizing" : ""}`}
      data-media-block-id={block.id}
      data-block-type={block.type}
      initial={{ opacity: 0, y: 4 }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onRemove();
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          onFocusPrev();
        } else if (
          event.key === "ArrowDown" ||
          event.key === "ArrowRight" ||
          event.key === "Enter"
        ) {
          event.preventDefault();
          onFocusNext();
        }
      }}
      ref={ref}
      style={{ width: grouped || wrapped ? "100%" : `${width}%` }}
      tabIndex={0}
      transition={{ duration: 0.2 }}
    >
      {grouped ? null : (
        <>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Opciones de ${mediaLabel}`}
            className={`media-block__handle ${menuOpen ? "is-open" : ""}`}
            data-media-handle
            onClick={toggleMenu}
            ref={handleRef}
            title="Acomodar"
            type="button"
          >
            <SlidersHorizontal size={14} />
          </button>
          {menuOpen && menuAnchor && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="media-block__menu"
                  data-media-menu
                  role="menu"
                  style={{
                    position: "fixed",
                    right: menuAnchor.right,
                    top: menuAnchor.top
                  }}
                >
                  <div
                    aria-label={`Ajuste de texto para ${mediaLabel}`}
                    className="media-block__menu-group"
                    role="group"
                  >
                    <span className="media-block__menu-label">
                      Ajuste de texto
                    </span>
                    <div className="media-block__menu-row">
                      {(
                        [
                          [
                            "none",
                            "Sin ajuste",
                            <Rows3 key="none" size={15} />
                          ],
                          [
                            "left",
                            `Texto a la derecha de la ${mediaLabel}`,
                            <AlignLeft key="left" size={15} />
                          ],
                          [
                            "right",
                            `Texto a la izquierda de la ${mediaLabel}`,
                            <AlignRight key="right" size={15} />
                          ]
                        ] as const
                      ).map(([value, label, icon]) => (
                        <button
                          aria-label={label}
                          aria-pressed={mediaWrap === value}
                          key={value}
                          onClick={() =>
                            onUpdate({
                              alignment: value === "none" ? alignment : value,
                              mediaWrap: value
                            })
                          }
                          title={label}
                          type="button"
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  {mediaWrap === "none" ? (
                    <div
                      aria-label={`Alinear ${mediaLabel}`}
                      className="media-block__menu-group"
                      role="group"
                    >
                      <span className="media-block__menu-label">
                        Alineación
                      </span>
                      <div className="media-block__menu-row">
                        {(
                          [
                            [
                              "left",
                              "Izquierda",
                              <AlignLeft key="left" size={15} />
                            ],
                            [
                              "center",
                              "Centro",
                              <AlignCenter key="center" size={15} />
                            ],
                            [
                              "right",
                              "Derecha",
                              <AlignRight key="right" size={15} />
                            ]
                          ] as const
                        ).map(([value, label, icon]) => (
                          <button
                            aria-label={`Alinear ${mediaLabel} ${
                              value === "center"
                                ? "al centro"
                                : `a la ${label.toLowerCase()}`
                            }`}
                            aria-pressed={alignment === value}
                            key={value}
                            onClick={() => onUpdate({ alignment: value })}
                            title={label}
                            type="button"
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div
                    aria-label={`Tamaño de la ${mediaLabel}`}
                    className="media-block__menu-group"
                    role="group"
                  >
                    <span className="media-block__menu-label">Tamaño</span>
                    <div className="media-block__menu-row">
                      {([25, 50, 75, 100] as const).map((preset) => (
                        <button
                          aria-label={`${preset}%`}
                          aria-pressed={width === preset}
                          className="media-block__menu-size"
                          key={preset}
                          onClick={() => onUpdate({ width: preset })}
                          type="button"
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
        </>
      )}
      <div className="media-block__surface">
        {block.type === "image" ? (
          imageUrl && !imageError ? (
            <img alt={block.alt ?? ""} draggable={false} src={imageUrl} />
          ) : (
            <div className="media-block__fallback">
              <ImageIcon aria-hidden="true" size={24} />
              <span>No se pudo cargar la imagen</span>
            </div>
          )
        ) : video?.kind === "direct" ? (
          <video controls preload="metadata" src={video.embedUrl} />
        ) : video ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={video.embedUrl}
            title={`${video.provider}: ${block.alt ?? "Video"}`}
          />
        ) : (
          <div className="media-block__fallback">
            <Video aria-hidden="true" size={24} />
            <span>Enlace de video no compatible</span>
          </div>
        )}
        {(alignment === "left"
          ? (["right"] as const)
          : alignment === "right"
            ? (["left"] as const)
            : (["left", "right"] as const)
        ).map((edge) => (
          <button
            aria-label={`Redimensionar ${mediaLabel} desde la esquina ${edge === "left" ? "izquierda" : "derecha"}`}
            className={`media-block__resize-corner is-${edge}`}
            key={edge}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const containerWidth =
                (wrapped
                  ? ref.current
                      ?.closest<HTMLElement>(".block-editor-root")
                      ?.getBoundingClientRect().width
                  : grouped
                    ? ref.current
                        ?.closest<HTMLElement>(".media-row")
                        ?.getBoundingClientRect().width
                    : ref.current?.parentElement?.getBoundingClientRect()
                        .width) ?? 0;
              resizeRef.current = {
                containerWidth,
                edge,
                frameId: 0,
                latestWidth: width,
                pointerId: event.pointerId,
                startPointerX: event.clientX,
                startWidth: width
              };
              setResizing(true);
            }}
            title="Arrastra para cambiar el tamaño"
            type="button"
          />
        ))}
      </div>
    </motion.div>
  );
}

function VideoDialog({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (source: string) => void;
}) {
  const [source, setSource] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizeVideoSource(source)) {
      setInvalid(true);
      return;
    }
    onSubmit(source.trim());
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="media-dialog-backdrop"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.form
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="media-dialog"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        onSubmit={submit}
      >
        <div className="media-dialog__icon">
          <Video aria-hidden="true" size={20} />
        </div>
        <div>
          <h2>Insertar video</h2>
          <p>YouTube, Vimeo, Loom, Dailymotion o un archivo HTTPS directo.</p>
        </div>
        <input
          aria-label="Enlace del video"
          autoFocus
          onChange={(event) => {
            setSource(event.target.value);
            setInvalid(false);
          }}
          placeholder="https://youtube.com/watch?v=..."
          value={source}
        />
        {invalid ? (
          <span className="media-dialog__error">
            Usa un enlace HTTPS de un proveedor compatible.
          </span>
        ) : null}
        <div className="media-dialog__actions">
          <button onClick={onClose} type="button">
            Cancelar
          </button>
          <button type="submit">Insertar</button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function CodeBlock({
  block,
  focusRequest,
  onChangeType,
  onFocusNext,
  onFocusPrev,
  onUpdate
}: {
  block: Block;
  focusRequest: { id: string } | null;
  onChangeType: (type: BlockType) => void;
  onFocusNext: () => void;
  onFocusPrev: () => void;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const highlighted = useMemo(
    () => highlightCode(block.text, block.language),
    [block.language, block.text]
  );

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(112, textarea.scrollHeight)}px`;
  }, [block.text]);

  useEffect(() => {
    if (!focusRequest || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(block.text.length, block.text.length);
  }, [block.text.length, focusRequest]);

  const selectedLanguage = normalizeCodeLanguage(block.language ?? "") ?? "";
  const detectedLabel =
    CODE_LANGUAGE_OPTIONS.find(
      (option) => option.value === highlighted.language
    )?.label ??
    highlighted.language ??
    "Texto";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="code-editor group/code my-4 overflow-hidden rounded-xl"
      initial={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    >
      <div className="code-editor__header">
        <div className="code-editor__lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="code-editor__title">Código</span>
        <label className="code-editor__language">
          <span className="sr-only">Lenguaje</span>
          <select
            aria-label="Lenguaje del código"
            onChange={(event) =>
              onUpdate({
                language: event.target.value || undefined
              })
            }
            value={selectedLanguage}
          >
            {CODE_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value || "auto"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedLanguage ? null : (
            <span className="code-editor__detected">{detectedLabel}</span>
          )}
        </label>
      </div>
      <div className="code-editor__body">
        <pre
          aria-hidden="true"
          className="code-editor__highlight"
          dangerouslySetInnerHTML={{
            __html: highlighted.html || " "
          }}
          ref={highlightRef}
        />
        <textarea
          aria-label="Código"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="code-editor__input"
          onChange={(event) => onUpdate({ text: event.target.value })}
          onKeyDown={(event) => {
            const textarea = event.currentTarget;
            if (event.key === "Tab") {
              event.preventDefault();
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const nextText = `${block.text.slice(0, start)}  ${block.text.slice(end)}`;
              onUpdate({ text: nextText });
              requestAnimationFrame(() => {
                textarea.setSelectionRange(start + 2, start + 2);
              });
            } else if (
              event.key === "Backspace" &&
              block.text === "" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              onChangeType("p");
            } else if (
              event.key === "ArrowUp" &&
              textarea.selectionStart === 0 &&
              textarea.selectionEnd === 0
            ) {
              event.preventDefault();
              onFocusPrev();
            } else if (
              event.key === "ArrowDown" &&
              textarea.selectionStart === block.text.length &&
              textarea.selectionEnd === block.text.length
            ) {
              event.preventDefault();
              onFocusNext();
            } else if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              onFocusNext();
            }
          }}
          onScroll={(event) => {
            const highlight = highlightRef.current;
            if (!highlight) return;
            highlight.scrollTop = event.currentTarget.scrollTop;
            highlight.scrollLeft = event.currentTarget.scrollLeft;
          }}
          placeholder="Escribe o pega código…"
          ref={textareaRef}
          spellCheck={false}
          value={block.text}
        />
      </div>
    </motion.div>
  );
}

function DividerBlock({
  focusRequest,
  onFocusNext,
  onFocusPrev,
  onRemove
}: {
  focusRequest: { id: string } | null;
  onFocusNext: () => void;
  onFocusPrev: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusRequest) ref.current?.focus();
  }, [focusRequest]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      aria-label="Divisor"
      className="group relative my-3 cursor-default rounded-sm py-2 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      data-block-type="divider"
      initial={{ opacity: 0, y: 4 }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          onRemove();
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          onFocusPrev();
        } else if (
          event.key === "ArrowDown" ||
          event.key === "ArrowRight" ||
          event.key === "Enter"
        ) {
          event.preventDefault();
          onFocusNext();
        }
      }}
      ref={ref}
      role="separator"
      tabIndex={0}
      transition={{ duration: 0.2 }}
    >
      <div className="h-px bg-[color:var(--line-strong)] transition-colors group-focus:bg-[color:var(--accent)]" />
    </motion.div>
  );
}

function TableBlock({
  block,
  focusRequest,
  onFocusNext,
  onFocusPrev,
  onUpdate
}: {
  block: Block;
  focusRequest: { id: string } | null;
  onFocusNext: () => void;
  onFocusPrev: () => void;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const rows = block.rows ?? [
    ["", ""],
    ["", ""]
  ];
  const columns = rows[0]?.length ?? 2;
  const resizeRef = useRef<{
    pointerId: number;
    startColumns: number;
    startRows: number;
    startX: number;
    startY: number;
    sourceRows: string[][];
  } | null>(null);
  const [resizing, setResizing] = useState(false);

  const setCell = (rowIndex: number, columnIndex: number, text: string) => {
    onUpdate({
      rows: rows.map((row, nextRowIndex) =>
        row.map((cell, nextColumnIndex) =>
          nextRowIndex === rowIndex && nextColumnIndex === columnIndex
            ? text
            : cell
        )
      )
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;
      const size = resolveTableDragSize({
        deltaX: event.clientX - resize.startX,
        deltaY: event.clientY - resize.startY,
        startColumns: resize.startColumns,
        startRows: resize.startRows
      });
      onUpdate({
        rows: resizeTableGrid(resize.sourceRows, size.rows, size.columns)
      });
    };

    const finishResize = (event: PointerEvent) => {
      if (resizeRef.current?.pointerId !== event.pointerId) return;
      resizeRef.current = null;
      setResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [onUpdate, resizing]);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`table-block group/table my-4 ${resizing ? "is-resizing" : ""}`}
      initial={{ opacity: 0, y: 4 }}
    >
      <div className="table-block__surface">
        <div className="table-block__viewport">
          <table className="border-collapse">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, columnIndex) => (
                    <td
                      className={`border-r border-b border-[color:var(--line)] last:border-r-0 ${
                        rowIndex === rows.length - 1 ? "border-b-0" : ""
                      } ${rowIndex === 0 ? "bg-[color:var(--accent-soft)]" : ""}`}
                      key={columnIndex}
                    >
                      <TableCell
                        autoFocus={
                          Boolean(focusRequest) &&
                          rowIndex === 0 &&
                          columnIndex === 0
                        }
                        isHeader={rowIndex === 0}
                        onExitAfter={
                          rowIndex === rows.length - 1 &&
                          columnIndex === row.length - 1
                            ? onFocusNext
                            : undefined
                        }
                        onExitBefore={
                          rowIndex === 0 && columnIndex === 0
                            ? onFocusPrev
                            : undefined
                        }
                        onCommit={(text) =>
                          setCell(rowIndex, columnIndex, text)
                        }
                        value={cell}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="table-block__size" aria-live="polite">
          {rows.length} × {columns}
        </span>
        <button
          aria-label="Redimensionar tabla"
          className="table-block__resize-handle"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            resizeRef.current = {
              pointerId: event.pointerId,
              sourceRows: rows.map((row) => [...row]),
              startColumns: columns,
              startRows: rows.length,
              startX: event.clientX,
              startY: event.clientY
            };
            setResizing(true);
          }}
          title="Arrastra para añadir o quitar filas y columnas"
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </motion.div>
  );
}

function TableCell({
  autoFocus,
  isHeader,
  onCommit,
  onExitAfter,
  onExitBefore,
  value
}: {
  autoFocus: boolean;
  isHeader: boolean;
  onCommit: (text: string) => void;
  onExitAfter?: (() => void) | undefined;
  onExitBefore?: (() => void) | undefined;
  value: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Mirror the block editor: only write the cell text when it actually differs
  // from the DOM, so committing on input never resets the caret to the start
  // (which made typed characters appear reversed).
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      placeCaretAtEnd(ref.current);
    }
  }, [autoFocus]);

  return (
    <div
      className={`min-w-[110px] px-3 py-1.5 text-[14px] outline-none ${
        isHeader ? "font-display text-[13.5px] font-semibold" : ""
      }`}
      contentEditable
      onBlur={(event) => onCommit(event.currentTarget.textContent ?? "")}
      onInput={(event) => onCommit(event.currentTarget.textContent ?? "")}
      onKeyDown={(event) => {
        const element = ref.current;
        if (!element) return;
        if (event.key === "ArrowUp" && onExitBefore && caretAtStart(element)) {
          event.preventDefault();
          onExitBefore();
        } else if (
          event.key === "ArrowDown" &&
          onExitAfter &&
          caretAtEnd(element)
        ) {
          event.preventDefault();
          onExitAfter();
        }
      }}
      ref={ref}
      suppressContentEditableWarning
    />
  );
}

function SlashMenu({
  anchor,
  onClose,
  onSelect,
  query
}: {
  anchor: { x: number; top: number; bottom: number };
  query: string;
  onSelect: (option: SlashOption) => void;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return SLASH_OPTIONS;
    return SLASH_OPTIONS.filter(
      (option) =>
        option.match.some(
          (item) =>
            item.startsWith(normalizedQuery) || item.includes(normalizedQuery)
        ) || option.label.toLowerCase().includes(normalizedQuery)
    );
  }, [query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(() =>
    resolveSlashMenuPosition({
      anchor,
      menuHeight: 360,
      menuWidth: 260,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    })
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const updatePosition = () => {
      const bounds = menu.getBoundingClientRect();
      setPosition(
        resolveSlashMenuPosition({
          anchor,
          menuHeight: Math.max(bounds.height, menu.scrollHeight),
          menuWidth: bounds.width,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchor, filtered.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!filtered.length) return;
      // The menu owns these keys while open: stop propagation so the underlying
      // contentEditable block doesn't also handle Enter (inserting a block) or
      // the arrows (moving the caret/focus) at the same time.
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((current) => (current + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(
          (current) => (current - 1 + filtered.length) % filtered.length
        );
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const activeOption = filtered[activeIndex];
        if (activeOption) onSelect(activeOption);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeIndex, filtered, onClose, onSelect]);

  if (!filtered.length) return null;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="glass-strong w-[218px] rounded-[var(--radius-lg)] p-1.5"
      data-slash-menu
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      initial={{ opacity: 0, scale: 0.98, y: -4 }}
      ref={menuRef}
      style={{
        left: position.left,
        maxHeight: position.maxHeight,
        overflowY: "auto",
        position: "fixed",
        top: position.top,
        zIndex: 60
      }}
      transition={{ duration: 0.15 }}
    >
      <div className="px-2.5 pt-1 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--faint)]">
        Bloques
      </div>
      <div className="flex flex-col">
        {filtered.map((option, index) => (
          <button
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
              index === activeIndex
                ? "bg-[color:var(--accent-soft)]"
                : "hover:bg-[color:var(--accent-soft)]"
            }`}
            key={option.key}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(option);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            title={option.hint}
            type="button"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[color:var(--bg-paper)] text-[color:var(--ink)]">
              {option.icon}
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium text-[color:var(--ink)]">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export function resolveSlashMenuPosition({
  anchor,
  menuHeight,
  menuWidth,
  viewportHeight,
  viewportWidth
}: {
  anchor: { x: number; top: number; bottom: number };
  menuHeight: number;
  menuWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}) {
  const gutter = 12;
  const topBoundary = 68;
  const gap = 8;
  const availableHeight = Math.max(120, viewportHeight - topBoundary - gutter);
  const maxHeight = Math.min(menuHeight, availableHeight, 420);
  const fitsBelow = anchor.bottom + gap + maxHeight + gutter <= viewportHeight;
  const top = fitsBelow
    ? anchor.bottom + gap
    : Math.max(topBoundary, anchor.top - gap - maxHeight);
  const maxLeft = Math.max(gutter, viewportWidth - menuWidth - gutter);

  return {
    left: Math.min(Math.max(anchor.x, gutter), maxLeft),
    maxHeight,
    top
  };
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function caretAtStart(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length === 0;
}

function caretAtEnd(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;
  const range = selection.getRangeAt(0);
  const postRange = range.cloneRange();
  postRange.selectNodeContents(element);
  postRange.setStart(range.endContainer, range.endOffset);
  return postRange.toString().length === 0;
}
