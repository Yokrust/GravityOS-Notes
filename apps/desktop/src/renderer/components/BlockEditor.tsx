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
  Type
} from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
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
    const line = lines[index];
    if (line === undefined) break;

    if (/^```/.test(line)) {
      index += 1;
      const buffer: string[] = [];
      while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
        buffer.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ id: uid(), type: "code", text: buffer.join("\n") });
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
        text: stripMarkdown(heading[2] ?? "")
      });
      index += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      blocks.push({
        id: uid(),
        type: "quote",
        text: stripMarkdown(line.replace(/^>\s+/, ""))
      });
      index += 1;
      continue;
    }

    const todo = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (todo) {
      blocks.push({
        id: uid(),
        type: "todo",
        text: stripMarkdown(todo[2] ?? ""),
        checked: (todo[1] ?? "").toLowerCase() === "x"
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        id: uid(),
        type: "bullet",
        text: stripMarkdown(line.replace(/^[-*]\s+/, ""))
      });
      index += 1;
      continue;
    }

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    blocks.push({ id: uid(), type: "p", text: stripMarkdown(line) });
    index += 1;
  }

  return blocks.length ? blocks : [emptyBlock()];
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function serializeBlocks(blocks: Block[]): string {
  const output: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "p":
        output.push(block.text, "");
        break;
      case "h1":
        output.push(`# ${block.text}`, "");
        break;
      case "h2":
        output.push(`## ${block.text}`, "");
        break;
      case "h3":
        output.push(`### ${block.text}`, "");
        break;
      case "quote":
        output.push(`> ${block.text}`, "");
        break;
      case "bullet":
        output.push(`- ${block.text}`);
        break;
      case "todo":
        output.push(`- [${block.checked ? "x" : " "}] ${block.text}`);
        break;
      case "code":
        output.push("```", block.text, "```", "");
        break;
      case "divider":
        output.push("---", "");
        break;
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
  onChange,
  value
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(value));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [slash, setSlash] = useState<{
    blockId: string;
    query: string;
    rect: { x: number; top: number; bottom: number };
  } | null>(null);
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

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block))
    );
  }, []);

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
    setFocusId(nextBlock.id);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index < 0) return current;
      const next = [...current.slice(0, index), ...current.slice(index + 1)];
      if (!next.length) next.push(emptyBlock());
      const target = next[Math.max(0, index - 1)];
      if (target) setFocusId(target.id);
      return next;
    });
  }, []);

  const changeType = useCallback((id: string, type: BlockType) => {
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== id) return block;
        const option = SLASH_OPTIONS.find(
          (candidate) => candidate.key === type
        );
        return option ? option.apply(block) : { ...block, type };
      })
    );
  }, []);

  return (
    <div className="relative">
      {blocks.map((block, index) => (
        <BlockView
          autoFocus={focusId === block.id}
          block={block}
          key={block.id}
          onChangeType={(type) => changeType(block.id, type)}
          onCloseSlash={() => setSlash(null)}
          onFocusNext={() => {
            const nextBlock = blocks[index + 1];
            if (nextBlock) setFocusId(nextBlock.id);
          }}
          onFocusPrev={() => {
            const previousBlock = blocks[index - 1];
            if (previousBlock) setFocusId(previousBlock.id);
          }}
          onInsertAfter={(type) => insertAfter(block.id, type)}
          onOpenSlash={(query, rect) =>
            setSlash({ blockId: block.id, query, rect })
          }
          onRemove={() => removeBlock(block.id)}
          onUpdate={(patch) => updateBlock(block.id, patch)}
          slashOpen={slash?.blockId === block.id}
        />
      ))}

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {slash ? (
                <SlashMenu
                  anchor={slash.rect}
                  onClose={() => setSlash(null)}
                  onSelect={(option) => {
                    changeType(slash.blockId, option.key as BlockType);
                    setSlash(null);
                    setFocusId(slash.blockId);
                  }}
                  query={slash.query}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}

function BlockView({
  autoFocus,
  block,
  onChangeType,
  onCloseSlash,
  onFocusNext,
  onFocusPrev,
  onInsertAfter,
  onOpenSlash,
  onRemove,
  onUpdate,
  slashOpen
}: {
  block: Block;
  autoFocus: boolean;
  onUpdate: (patch: Partial<Block>) => void;
  onInsertAfter: (type?: BlockType) => void;
  onRemove: () => void;
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
    if (element.textContent !== block.text) {
      element.textContent = block.text;
    }
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
        animate={{ opacity: 1, y: 0 }}
        className="group relative my-5"
        initial={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.2 }}
      >
        <div className="h-px bg-[color:var(--line-strong)]" />
      </motion.div>
    );
  }

  if (block.type === "table") {
    return <TableBlock block={block} onUpdate={onUpdate} />;
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const text = element.textContent ?? "";

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onUpdate({ text });

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
        onRemove();
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
    onUpdate({ text });

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
              onUpdate({ text: "", type: nextType });
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

  const textClasses: Record<BlockType, string> = {
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
    table: ""
  };

  const editable = (
    <div
      className={`outline-none whitespace-pre-wrap break-words ${textClasses[block.type]}`}
      contentEditable
      data-block-type={block.type}
      data-placeholder={placeholder}
      onBlur={() => onUpdate({ text: ref.current?.textContent ?? "" })}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      ref={ref}
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

function TableBlock({
  block,
  onUpdate
}: {
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const rows = block.rows ?? [
    ["", ""],
    ["", ""]
  ];
  const columns = rows[0]?.length ?? 2;

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

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group/table my-4"
      initial={{ opacity: 0, y: 4 }}
    >
      <div className="inline-block overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--line)] bg-[color:var(--bg-paper)]/70">
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
                    <div
                      className={`min-w-[110px] px-3 py-1.5 text-[14px] outline-none ${
                        rowIndex === 0
                          ? "font-display text-[13.5px] font-semibold"
                          : ""
                      }`}
                      contentEditable
                      dangerouslySetInnerHTML={{ __html: cell }}
                      onBlur={(event) =>
                        setCell(
                          rowIndex,
                          columnIndex,
                          event.currentTarget.textContent ?? ""
                        )
                      }
                      onInput={(event) =>
                        setCell(
                          rowIndex,
                          columnIndex,
                          event.currentTarget.textContent ?? ""
                        )
                      }
                      suppressContentEditableWarning
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-2 opacity-0 transition group-hover/table:opacity-100">
        <button
          className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--faint)] hover:text-[color:var(--ink)]"
          onClick={() => onUpdate({ rows: [...rows, Array(columns).fill("")] })}
          type="button"
        >
          + fila
        </button>
        <button
          className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--faint)] hover:text-[color:var(--ink)]"
          onClick={() => onUpdate({ rows: rows.map((row) => [...row, ""]) })}
          type="button"
        >
          + columna
        </button>
      </div>
    </motion.div>
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
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (current) => (current - 1 + filtered.length) % filtered.length
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const activeOption = filtered[activeIndex];
        if (activeOption) onSelect(activeOption);
      } else if (event.key === "Escape") {
        event.preventDefault();
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
      className="glass-strong w-[260px] rounded-[var(--radius-lg)] p-1.5"
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
      <div className="px-2.5 pt-1 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--faint)]">
        Bloques · /{query}
      </div>
      <div className="flex flex-col">
        {filtered.map((option, index) => (
          <button
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
              index === activeIndex
                ? "bg-[color:var(--accent-soft)]"
                : "hover:bg-[color:var(--accent-soft)]"
            }`}
            key={option.key}
            onClick={() => onSelect(option)}
            onMouseEnter={() => setActiveIndex(index)}
            type="button"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--line)] bg-[color:var(--bg-paper)] text-[color:var(--ink)]">
              {option.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-[color:var(--ink)]">
                {option.label}
              </span>
              <span className="truncate font-mono text-[11px] text-[color:var(--faint)]">
                {option.hint}
              </span>
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
