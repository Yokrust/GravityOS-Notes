"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  Minus,
  Quote,
  Table as TableIcon,
  Type,
} from "lucide-react";

// ────────────────────────────── types & helpers

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
  | "table";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  rows?: string[][];
}

const emptyBlock = (type: BlockType = "p"): Block => {
  if (type === "divider") return { id: uid(), type, text: "" };
  if (type === "table")
    return {
      id: uid(),
      type,
      text: "",
      rows: [
        ["", ""],
        ["", ""],
      ],
    };
  if (type === "todo") return { id: uid(), type, text: "", checked: false };
  return { id: uid(), type, text: "" };
};

export function parseMarkdown(src: string): Block[] {
  if (!src.trim()) return [emptyBlock()];
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // code fence
    if (/^```/.test(line)) {
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ id: uid(), type: "code", text: buf.join("\n") });
      continue;
    }
    // table
    if (/^\s*\|.+\|\s*$/.test(line) && /^\s*\|.+\|\s*$/.test(lines[i + 1] ?? "")) {
      const rows: string[][] = [];
      const parseRow = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      rows.push(parseRow(line));
      i++;
      // separator
      if (/^\s*\|[\s|:-]+\|\s*$/.test(lines[i] ?? "")) i++;
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ id: uid(), type: "table", text: "", rows });
      continue;
    }
    // divider
    if (/^\s*---\s*$/.test(line)) {
      blocks.push({ id: uid(), type: "divider", text: "" });
      i++;
      continue;
    }
    // headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({
        id: uid(),
        type: ("h" + level) as "h1" | "h2" | "h3",
        text: strip(h[2]),
      });
      i++;
      continue;
    }
    // quote
    if (/^>\s+/.test(line)) {
      blocks.push({ id: uid(), type: "quote", text: strip(line.replace(/^>\s+/, "")) });
      i++;
      continue;
    }
    // todo
    const t = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (t) {
      blocks.push({
        id: uid(),
        type: "todo",
        text: strip(t[2]),
        checked: t[1].toLowerCase() === "x",
      });
      i++;
      continue;
    }
    // bullet
    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        id: uid(),
        type: "bullet",
        text: strip(line.replace(/^[-*]\s+/, "")),
      });
      i++;
      continue;
    }
    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }
    blocks.push({ id: uid(), type: "p", text: strip(line) });
    i++;
  }
  return blocks.length ? blocks : [emptyBlock()];
}

// Strip simple inline markdown markers to plain text (keeps content readable).
function strip(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function serializeBlocks(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "p":
        out.push(b.text);
        out.push("");
        break;
      case "h1":
        out.push(`# ${b.text}`);
        out.push("");
        break;
      case "h2":
        out.push(`## ${b.text}`);
        out.push("");
        break;
      case "h3":
        out.push(`### ${b.text}`);
        out.push("");
        break;
      case "quote":
        out.push(`> ${b.text}`);
        out.push("");
        break;
      case "bullet":
        out.push(`- ${b.text}`);
        break;
      case "todo":
        out.push(`- [${b.checked ? "x" : " "}] ${b.text}`);
        break;
      case "code":
        out.push("```");
        out.push(b.text);
        out.push("```");
        out.push("");
        break;
      case "divider":
        out.push("---");
        out.push("");
        break;
      case "table": {
        const rows = b.rows ?? [["", ""]];
        const w = rows[0]?.length ?? 2;
        out.push("| " + rows[0].map((c) => c || " ").join(" | ") + " |");
        out.push("| " + Array(w).fill("---").join(" | ") + " |");
        for (let r = 1; r < rows.length; r++) {
          out.push("| " + rows[r].map((c) => c || " ").join(" | ") + " |");
        }
        out.push("");
        break;
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ────────────────────────────── slash menu options

interface SlashOption {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  match: string[];
  apply: (b: Block) => Block;
}

const SLASH_OPTIONS: SlashOption[] = [
  {
    key: "p",
    label: "Texto",
    hint: "Párrafo simple",
    icon: <Type size={14} />,
    match: ["text", "texto", "parrafo", "párrafo", "p"],
    apply: (b) => ({ ...b, type: "p", text: "" }),
  },
  {
    key: "h1",
    label: "Encabezado 1",
    hint: "Título principal",
    icon: <Heading1 size={14} />,
    match: ["h1", "heading1", "heading 1", "titulo", "título", "encabezado"],
    apply: (b) => ({ ...b, type: "h1", text: "" }),
  },
  {
    key: "h2",
    label: "Encabezado 2",
    hint: "Sección",
    icon: <Heading2 size={14} />,
    match: ["h2", "heading2", "seccion", "sección"],
    apply: (b) => ({ ...b, type: "h2", text: "" }),
  },
  {
    key: "h3",
    label: "Encabezado 3",
    hint: "Sub-sección",
    icon: <Heading3 size={14} />,
    match: ["h3", "heading3"],
    apply: (b) => ({ ...b, type: "h3", text: "" }),
  },
  {
    key: "bullet",
    label: "Lista",
    hint: "Viñetas",
    icon: <List size={14} />,
    match: ["bullet", "list", "lista", "viñeta", "vinetas"],
    apply: (b) => ({ ...b, type: "bullet", text: "" }),
  },
  {
    key: "todo",
    label: "Tarea",
    hint: "Casilla con texto",
    icon: <CheckSquare size={14} />,
    match: ["todo", "tarea", "check", "checkbox"],
    apply: (b) => ({ ...b, type: "todo", text: "", checked: false }),
  },
  {
    key: "quote",
    label: "Cita",
    hint: "Frase destacada",
    icon: <Quote size={14} />,
    match: ["quote", "cita", "blockquote"],
    apply: (b) => ({ ...b, type: "quote", text: "" }),
  },
  {
    key: "code",
    label: "Código",
    hint: "Bloque monoespaciado",
    icon: <Code2 size={14} />,
    match: ["code", "codigo", "código"],
    apply: (b) => ({ ...b, type: "code", text: "" }),
  },
  {
    key: "divider",
    label: "Divisor",
    hint: "Línea horizontal",
    icon: <Minus size={14} />,
    match: ["divider", "divisor", "linea", "línea", "hr"],
    apply: (b) => ({ ...b, type: "divider", text: "" }),
  },
  {
    key: "table",
    label: "Tabla",
    hint: "2 × 2 editable",
    icon: <TableIcon size={14} />,
    match: ["table", "tabla"],
    apply: (b) => ({
      ...b,
      type: "table",
      text: "",
      rows: [
        ["", ""],
        ["", ""],
      ],
    }),
  },
];

// Inline shortcuts: first few chars converts block type on space.
const INLINE_SHORTCUTS: Record<string, BlockType> = {
  "#": "h1",
  "##": "h2",
  "###": "h3",
  ">": "quote",
  "-": "bullet",
  "*": "bullet",
  "[]": "todo",
  "[ ]": "todo",
  "```": "code",
  "---": "divider",
  "|": "table",
};

// ────────────────────────────── editor

interface BlockEditorProps {
  value: string;
  onChange: (next: string) => void;
}

export function BlockEditor({ value, onChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(value));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slash, setSlash] = useState<{
    blockId: string;
    query: string;
    rect: { x: number; y: number };
  } | null>(null);

  // Track initial value id to avoid re-parse when we're the source of change.
  const lastExternal = useRef(value);

  // If value changes externally (e.g. different note selected), re-parse.
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setBlocks(parseMarkdown(value));
    }
  }, [value]);

  // Propagate changes upward (debounced via parent already).
  useEffect(() => {
    const serialized = serializeBlocks(blocks);
    if (serialized !== lastExternal.current) {
      lastExternal.current = serialized;
      onChange(serialized);
    }
  }, [blocks, onChange]);

  // Mutators ──────────────────────
  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const insertAfter = useCallback(
    (id: string, type: BlockType = "p", focus = true) => {
      const nb = emptyBlock(type);
      setBlocks((bs) => {
        const idx = bs.findIndex((b) => b.id === id);
        if (idx < 0) return bs;
        return [...bs.slice(0, idx + 1), nb, ...bs.slice(idx + 1)];
      });
      if (focus) setFocusId(nb.id);
      return nb.id;
    },
    [],
  );

  const removeBlock = useCallback(
    (id: string, focusPrev = true) => {
      setBlocks((bs) => {
        const idx = bs.findIndex((b) => b.id === id);
        if (idx < 0) return bs;
        const next = [...bs.slice(0, idx), ...bs.slice(idx + 1)];
        if (next.length === 0) next.push(emptyBlock());
        if (focusPrev) {
          const target = next[Math.max(0, idx - 1)];
          if (target) setFocusId(target.id);
        }
        return next;
      });
    },
    [],
  );

  const changeType = useCallback((id: string, type: BlockType) => {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b;
        const opt = SLASH_OPTIONS.find((o) => o.key === type);
        if (opt) return opt.apply(b);
        return { ...b, type };
      }),
    );
  }, []);

  const focusBlock = useCallback((id: string | null) => setFocusId(id), []);

  const openSlash = useCallback(
    (blockId: string, query: string, rect: { x: number; y: number }) =>
      setSlash({ blockId, query, rect }),
    [],
  );
  const closeSlash = useCallback(() => setSlash(null), []);

  return (
    <div className="relative">
      {blocks.map((b, i) => (
        <BlockView
          key={b.id}
          block={b}
          index={i}
          autoFocus={focusId === b.id}
          onUpdate={(patch) => updateBlock(b.id, patch)}
          onInsertAfter={(type) => insertAfter(b.id, type)}
          onRemove={() => removeBlock(b.id)}
          onChangeType={(type) => changeType(b.id, type)}
          onFocusPrev={() => {
            const idx = blocks.findIndex((x) => x.id === b.id);
            if (idx > 0) focusBlock(blocks[idx - 1].id);
          }}
          onFocusNext={() => {
            const idx = blocks.findIndex((x) => x.id === b.id);
            if (idx < blocks.length - 1) focusBlock(blocks[idx + 1].id);
          }}
          onOpenSlash={(query, rect) => openSlash(b.id, query, rect)}
          onCloseSlash={closeSlash}
          slashOpen={slash?.blockId === b.id}
        />
      ))}

      <AnimatePresence>
        {slash && (
          <SlashMenu
            key={slash.blockId}
            query={slash.query}
            x={slash.rect.x}
            y={slash.rect.y}
            onSelect={(opt) => {
              changeType(slash.blockId, opt.key as BlockType);
              closeSlash();
              setFocusId(slash.blockId);
            }}
            onClose={closeSlash}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────── block view

interface BlockViewProps {
  block: Block;
  index: number;
  autoFocus: boolean;
  onUpdate: (patch: Partial<Block>) => void;
  onInsertAfter: (type?: BlockType) => void;
  onRemove: () => void;
  onChangeType: (type: BlockType) => void;
  onFocusPrev: () => void;
  onFocusNext: () => void;
  onOpenSlash: (query: string, rect: { x: number; y: number }) => void;
  onCloseSlash: () => void;
  slashOpen: boolean;
}

function BlockView(props: BlockViewProps) {
  const { block, autoFocus, onUpdate, onInsertAfter, onRemove } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync DOM text with state without disturbing caret.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.textContent !== block.text) el.textContent = block.text;
  }, [block.text]);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      placeCaretAtEnd(ref.current);
    }
  }, [autoFocus]);

  if (block.type === "divider") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="group relative my-5"
      >
        <div className="h-px bg-[color:var(--line-strong)]" />
      </motion.div>
    );
  }

  if (block.type === "table") {
    return <TableBlock block={block} onUpdate={onUpdate} />;
  }

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onUpdate({ text });
      // Exit heading/quote with empty enter
      if (
        (block.type === "h1" ||
          block.type === "h2" ||
          block.type === "h3" ||
          block.type === "quote" ||
          block.type === "code") &&
        !text
      ) {
        props.onChangeType("p");
        return;
      }
      if ((block.type === "bullet" || block.type === "todo") && !text) {
        props.onChangeType("p");
        return;
      }
      onInsertAfter(
        block.type === "bullet" || block.type === "todo" ? block.type : "p",
      );
      return;
    }

    if (e.key === "Backspace" && text === "" && !e.shiftKey) {
      e.preventDefault();
      if (block.type !== "p") {
        props.onChangeType("p");
      } else {
        onRemove();
      }
      return;
    }

    if (e.key === "ArrowUp" && caretAtStart(el)) {
      e.preventDefault();
      props.onFocusPrev();
      return;
    }
    if (e.key === "ArrowDown" && caretAtEnd(el)) {
      e.preventDefault();
      props.onFocusNext();
      return;
    }

    if (e.key === "Escape" && props.slashOpen) {
      e.preventDefault();
      props.onCloseSlash();
      return;
    }
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    onUpdate({ text });

    // Inline shortcut: block starts with token followed by space, convert.
    if (block.type === "p") {
      const m = text.match(/^(#{1,3}|>|-|\*|\[\s*\]|\[\s*x\s*\]|```|---|\|)\s$/i);
      if (m) {
        const token = m[1];
        let type: BlockType | null = null;
        let asTodo: boolean | undefined;
        if (token === "#") type = "h1";
        else if (token === "##") type = "h2";
        else if (token === "###") type = "h3";
        else if (token === ">") type = "quote";
        else if (token === "-" || token === "*") type = "bullet";
        else if (/^\[\s*\]$/.test(token)) {
          type = "todo";
          asTodo = false;
        } else if (/^\[\s*x\s*\]$/i.test(token)) {
          type = "todo";
          asTodo = true;
        } else if (token === "```") type = "code";
        else if (token === "---") type = "divider";
        else if (token === "|") type = "table";
        if (type) {
          // Defer to next tick so React flush happens.
          queueMicrotask(() => {
            if (type === "todo")
              onUpdate({ type, text: "", checked: asTodo ?? false });
            else onUpdate({ type, text: "" });
          });
          return;
        }
      }
    }

    // Slash menu trigger
    if (text.startsWith("/")) {
      const query = text.slice(1);
      const r = el.getBoundingClientRect();
      props.onOpenSlash(query, { x: r.left, y: r.bottom + 4 });
    } else if (props.slashOpen) {
      props.onCloseSlash();
    }
  };

  const common =
    "outline-none whitespace-pre-wrap break-words placeholder:text-[color:var(--faint)]";

  const renderText = () => {
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
                    : block.type === "code"
                      ? "Código"
                      : "";
    const classes: Record<BlockType, string> = {
      p: "text-[15.5px] leading-[1.72] text-[color:var(--ink)] py-1",
      h1: "font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] mt-6 mb-1",
      h2: "font-display text-[23px] leading-[1.15] font-semibold tracking-[-0.02em] mt-5 mb-1",
      h3: "font-display text-[18px] leading-[1.2] font-semibold tracking-[-0.015em] mt-4 mb-1",
      quote:
        "font-display italic text-[17px] leading-[1.55] text-[color:var(--muted)] border-l-2 border-[color:var(--ink)] pl-4 my-2",
      bullet: "text-[15.5px] leading-[1.72]",
      todo: "text-[15.5px] leading-[1.6]",
      code: "font-mono text-[13.5px] leading-[1.55] rounded-lg bg-[color:var(--accent-soft)] border border-[color:var(--line)] px-3 py-2 my-2",
      divider: "",
      table: "",
    };

    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKey}
        onInput={handleInput}
        onBlur={() => onUpdate({ text: ref.current?.textContent ?? "" })}
        data-placeholder={placeholder}
        className={`${common} ${classes[block.type]}`}
      />
    );
  };

  if (block.type === "bullet") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-start gap-3 pl-1"
      >
        <span className="mt-[10px] h-[5px] w-[5px] rounded-full bg-[color:var(--ink-2)] shrink-0" />
        <div className="flex-1 min-w-0">{renderText()}</div>
      </motion.div>
    );
  }

  if (block.type === "todo") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-start gap-3 pl-1 py-0.5"
      >
        <button
          onClick={() => onUpdate({ checked: !block.checked })}
          className={`mt-[5px] h-[15px] w-[15px] rounded-[5px] border transition shrink-0 grid place-items-center ${
            block.checked
              ? "bg-[color:var(--ink)] border-[color:var(--ink)]"
              : "border-[color:var(--line-strong)] hover:border-[color:var(--ink)]"
          }`}
        >
          {block.checked && (
            <svg
              viewBox="0 0 12 12"
              className="h-2.5 w-2.5 text-[color:var(--bg-paper)]"
            >
              <path
                d="M2.5 6.2 L5 8.5 L9.5 3.8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div
          className={`flex-1 min-w-0 ${
            block.checked ? "line-through text-[color:var(--muted)]" : ""
          }`}
        >
          {renderText()}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative"
    >
      {renderText()}
    </motion.div>
  );
}

// ────────────────────────────── table block

function TableBlock({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const rows = block.rows ?? [
    ["", ""],
    ["", ""],
  ];
  const cols = rows[0]?.length ?? 2;

  const setCell = (r: number, c: number, text: string) => {
    const next = rows.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? text : cell)),
    );
    onUpdate({ rows: next });
  };

  const addRow = () => onUpdate({ rows: [...rows, Array(cols).fill("")] });
  const addCol = () => onUpdate({ rows: rows.map((row) => [...row, ""]) });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 group/table"
    >
      <div className="inline-block rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-paper)]/70 overflow-hidden">
        <table className="border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border-r border-b border-[color:var(--line)] last:border-r-0 ${
                      ri === rows.length - 1 ? "border-b-0" : ""
                    } ${ri === 0 ? "bg-[color:var(--accent-soft)]" : ""}`}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) =>
                        setCell(ri, ci, e.currentTarget.textContent ?? "")
                      }
                      onBlur={(e) =>
                        setCell(ri, ci, e.currentTarget.textContent ?? "")
                      }
                      className={`outline-none px-3 py-1.5 min-w-[110px] text-[14px] ${
                        ri === 0
                          ? "font-display font-semibold text-[13.5px]"
                          : ""
                      }`}
                      dangerouslySetInnerHTML={{ __html: cell }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-2 opacity-0 group-hover/table:opacity-100 transition">
        <button
          onClick={addRow}
          className="text-[11px] uppercase tracking-wider font-mono text-[color:var(--faint)] hover:text-[color:var(--ink)]"
        >
          + fila
        </button>
        <button
          onClick={addCol}
          className="text-[11px] uppercase tracking-wider font-mono text-[color:var(--faint)] hover:text-[color:var(--ink)]"
        >
          + columna
        </button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────── slash menu

function SlashMenu({
  query,
  x,
  y,
  onSelect,
  onClose,
}: {
  query: string;
  x: number;
  y: number;
  onSelect: (opt: SlashOption) => void;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_OPTIONS;
    return SLASH_OPTIONS.filter(
      (o) =>
        o.match.some((m) => m.startsWith(q) || m.includes(q)) ||
        o.label.toLowerCase().includes(q),
    );
  }, [query]);

  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(filtered[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, active, onSelect, onClose]);

  if (!filtered.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{ position: "fixed", left: x, top: y, zIndex: 60 }}
      className="glass-strong rounded-[var(--radius-md)] w-[260px] p-1.5"
    >
      <div className="px-2.5 pt-1 pb-1.5 text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--faint)] font-mono">
        Bloques · /{query}
      </div>
      <div className="flex flex-col">
        {filtered.map((o, i) => (
          <button
            key={o.key}
            onMouseEnter={() => setActive(i)}
            onClick={() => onSelect(o)}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
              i === active
                ? "bg-[color:var(--accent-soft)]"
                : "hover:bg-[color:var(--accent-soft)]"
            }`}
          >
            <span className="grid place-items-center h-7 w-7 rounded-md border border-[color:var(--line)] bg-[color:var(--bg-paper)] text-[color:var(--ink)]">
              {o.icon}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-[color:var(--ink)]">
                {o.label}
              </span>
              <span className="text-[11px] text-[color:var(--faint)] font-mono truncate">
                {o.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ────────────────────────────── caret helpers

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length === 0;
}

function caretAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const range = sel.getRangeAt(0);
  const post = range.cloneRange();
  post.selectNodeContents(el);
  post.setStart(range.endContainer, range.endOffset);
  return post.toString().length === 0;
}
