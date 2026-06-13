import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StoreProvider } from "../../src/renderer/lib/store.js";
import {
  BlockEditor,
  deleteEmptyBlock,
  highlightCode,
  inlineMarkdownToPlainText,
  moveBlockToIndex,
  normalizeInlineLink,
  parseMarkdown,
  replaceBlockWithDivider,
  replaceBlockWithTable,
  resizeTableGrid,
  renderInlineMarkdown,
  resolveSlashMenuPosition,
  resolveTableDragSize,
  serializeBlocks
} from "../../src/renderer/components/BlockEditor.js";
import { NoteEditor } from "../../src/renderer/surfaces/notes-panel/note-editor.js";
import {
  EditableNodeName,
  normalizeInlineNodeName,
  NotesSidebar
} from "../../src/renderer/surfaces/notes-panel/notes-sidebar.js";

describe("notes panel", () => {
  it("renders the notebook sidebar with the notes surface selected", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreProvider,
        null,
        createElement(NotesSidebar, {
          activeSurface: "notes",
          onSelectSurface: vi.fn()
        })
      )
    );

    expect(markup).toContain("Sin carpeta");
    expect(markup).toContain("Notes");
    expect(markup).toContain("Elegir carpeta");
  });

  it("exposes inline renaming for note tree names", () => {
    const markup = renderToStaticMarkup(
      createElement(EditableNodeName, {
        name: "Nueva nota",
        onRename: vi.fn()
      })
    );

    expect(markup).toContain("Doble clic para cambiar el nombre");
    expect(markup).toContain("Nueva nota");
    expect(normalizeInlineNodeName("  Proyecto Gravity  ")).toBe(
      "Proyecto Gravity"
    );
    expect(normalizeInlineNodeName("   ")).toBeNull();
  });

  it("renders the notebook root onboarding inside the editor surface", () => {
    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(NoteEditor))
    );

    expect(markup).toContain("Leyendo cuaderno");
    expect(markup).toContain("Conecta una carpeta");
  });

  it("opens the block menu above the caret when the viewport has no room below", () => {
    expect(
      resolveSlashMenuPosition({
        anchor: { bottom: 690, top: 660, x: 700 },
        menuHeight: 320,
        menuWidth: 260,
        viewportHeight: 720,
        viewportWidth: 900
      })
    ).toEqual({
      left: 628,
      maxHeight: 320,
      top: 332
    });
  });

  it("marks heading blocks for compact contextual spacing", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockEditor, {
        onChange: vi.fn(),
        value: "# Encabezado"
      })
    );

    expect(markup).toContain("editor-block");
    expect(markup).toContain("is-heading");
    expect(markup).not.toContain("mt-6");
  });

  it("preserves inline formatting while parsing and serializing markdown", () => {
    const markdown =
      "Texto **importante**, *énfasis*, ++subrayado++ y =={pink}marcado==.";
    const blocks = parseMarkdown(markdown);

    expect(blocks[0]?.text).toBe(markdown);
    expect(serializeBlocks(blocks)).toBe(markdown);
  });

  it("renders the supported inline text formats safely", () => {
    const html = renderInlineMarkdown(
      "**Negrita** *cursiva* ++subrayado++ ~~tachado~~ `código` =={blue}marca== [Gravity](gravity.app)"
    );

    expect(html).toContain("<strong>Negrita</strong>");
    expect(html).toContain("<em>cursiva</em>");
    expect(html).toContain("<u>subrayado</u>");
    expect(html).toContain("<s>tachado</s>");
    expect(html).toContain("<code>código</code>");
    expect(html).toContain('<mark data-highlight="blue">marca</mark>');
    expect(html).toContain('href="https://gravity.app/"');
  });

  it("rejects unsafe inline links and counts formatted text as plain text", () => {
    expect(normalizeInlineLink("javascript:alert(1)")).toBeNull();
    expect(normalizeInlineLink("gravity.app")).toBe("https://gravity.app/");
    expect(
      inlineMarkdownToPlainText(
        "**Hola** =={yellow}mundo== [Gravity](https://gravity.app)"
      )
    ).toBe("Hola mundo Gravity");
  });

  it("replaces the slash command with a divider and an editable paragraph", () => {
    const blocks = replaceBlockWithDivider(
      [
        { id: "before", type: "p", text: "Arriba" },
        { id: "command", type: "p", text: "/divi" },
        { id: "after", type: "p", text: "Abajo" }
      ],
      "command",
      { id: "trailing", type: "p", text: "" }
    );

    expect(blocks).toEqual([
      { id: "before", type: "p", text: "Arriba" },
      { id: "command", type: "divider", text: "" },
      { id: "trailing", type: "p", text: "" },
      { id: "after", type: "p", text: "Abajo" }
    ]);
    expect(serializeBlocks(blocks)).not.toContain("/divi");
  });

  it("keeps a terminal divider writable without changing its markdown", () => {
    const blocks = parseMarkdown("Arriba\n\n---");

    expect(blocks.map((block) => block.type)).toEqual(["p", "divider", "p"]);
    expect(serializeBlocks(blocks)).toBe("Arriba\n\n---");
  });

  it("deletes the divider when backspace is pressed in the empty block below", () => {
    const result = deleteEmptyBlock(
      [
        { id: "before", type: "p", text: "Arriba" },
        { id: "divider", type: "divider", text: "" },
        { id: "editable", type: "p", text: "" }
      ],
      "editable",
      { id: "fallback", type: "p", text: "" }
    );

    expect(result).toEqual({
      blocks: [
        { id: "before", type: "p", text: "Arriba" },
        { id: "editable", type: "p", text: "" }
      ],
      focusId: "editable"
    });
  });

  it("replaces the slash command with a writable table and surrounding text", () => {
    const blocks = replaceBlockWithTable(
      [{ id: "command", type: "p", text: "/tabla" }],
      "command",
      {
        id: "table",
        type: "table",
        text: "",
        rows: [
          ["", ""],
          ["", ""]
        ]
      },
      { id: "before", type: "p", text: "" },
      { id: "after", type: "p", text: "" }
    );

    expect(blocks.map((block) => block.type)).toEqual(["p", "table", "p"]);
    expect(blocks[1]?.id).toBe("command");
    expect(serializeBlocks(blocks)).not.toContain("/tabla");
  });

  it("keeps a terminal table writable above and below after parsing", () => {
    const blocks = parseMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");

    expect(blocks.map((block) => block.type)).toEqual(["p", "table", "p"]);
    expect(serializeBlocks(blocks)).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("deletes the table when backspace is pressed in the empty block below", () => {
    const result = deleteEmptyBlock(
      [
        {
          id: "table",
          type: "table",
          text: "",
          rows: [
            ["", ""],
            ["", ""]
          ]
        },
        { id: "editable", type: "p", text: "" }
      ],
      "editable",
      { id: "fallback", type: "p", text: "" }
    );

    expect(result).toEqual({
      blocks: [{ id: "editable", type: "p", text: "" }],
      focusId: "editable"
    });
  });

  it("resizes a table while preserving the cells that still fit", () => {
    expect(
      resizeTableGrid(
        [
          ["Nombre", "Estado"],
          ["Gravity", "Activo"]
        ],
        3,
        4
      )
    ).toEqual([
      ["Nombre", "Estado", "", ""],
      ["Gravity", "Activo", "", ""],
      ["", "", "", ""]
    ]);

    expect(
      resizeTableGrid(
        [
          ["A", "B", "C"],
          ["1", "2", "3"],
          ["4", "5", "6"]
        ],
        2,
        2
      )
    ).toEqual([
      ["A", "B"],
      ["1", "2"]
    ]);
  });

  it("translates corner dragging into bounded rows and columns", () => {
    expect(
      resolveTableDragSize({
        deltaX: 250,
        deltaY: 80,
        startColumns: 2,
        startRows: 2
      })
    ).toEqual({ columns: 4, rows: 4 });

    expect(
      resolveTableDragSize({
        deltaX: -10_000,
        deltaY: 10_000,
        startColumns: 4,
        startRows: 4
      })
    ).toEqual({ columns: 2, rows: 12 });
  });

  it("moves blocks into insertion slots in either direction", () => {
    const blocks = [
      { id: "text", type: "p" as const, text: "Texto" },
      {
        id: "table",
        type: "table" as const,
        text: "",
        rows: [
          ["A", "B"],
          ["1", "2"]
        ]
      },
      { id: "quote", type: "quote" as const, text: "Cita" }
    ];

    expect(
      moveBlockToIndex(blocks, "table", 0).map((block) => block.id)
    ).toEqual(["table", "text", "quote"]);
    expect(
      moveBlockToIndex(blocks, "text", blocks.length).map((block) => block.id)
    ).toEqual(["table", "quote", "text"]);
  });

  it("keeps the same block order for adjacent no-op insertion slots", () => {
    const blocks = [
      { id: "first", type: "p" as const, text: "Uno" },
      { id: "second", type: "p" as const, text: "Dos" }
    ];

    expect(moveBlockToIndex(blocks, "first", 1)).toBe(blocks);
    expect(moveBlockToIndex(blocks, "second", 1)).toBe(blocks);
  });

  it("preserves the language declared by a fenced code block", () => {
    const markdown =
      '```typescript\nconst greeting: string = "hola";\nconsole.log(greeting);\n```';
    const blocks = parseMarkdown(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "code",
      language: "typescript",
      text: 'const greeting: string = "hola";\nconsole.log(greeting);'
    });
    expect(serializeBlocks(blocks)).toBe(markdown);
  });

  it("highlights language syntax without changing the code", () => {
    const code = 'const greeting = "hola";\nconsole.log(greeting);';
    const highlighted = highlightCode(code, "javascript");

    expect(highlighted.language).toBe("javascript");
    expect(highlighted.html).toContain("hljs-keyword");
    expect(highlighted.html).toContain("hljs-string");
    expect(highlighted.html).toContain("hljs-title");
    expect(highlighted.html).toContain("&quot;hola&quot;");
  });
});
