import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StoreProvider } from "../../src/renderer/lib/store.js";
import {
  anchorMediaToBlock,
  BlockEditor,
  buildEditorUnits,
  clipboardImageSource,
  dataTransferHasImage,
  deleteEmptyBlock,
  ensureStructuralWritingBlocks,
  getMediaInserterPosition,
  groupMediaBlocks,
  highlightCode,
  inlineMarkdownToPlainText,
  moveBlockToIndex,
  moveBlockWithWritingBoundaries,
  normalizeMediaAlignment,
  normalizeMediaWrap,
  normalizeMediaWidth,
  normalizeInlineLink,
  normalizePastedImageUrl,
  normalizeTextAlignment,
  normalizeVideoSource,
  parseMarkdown,
  replaceBlockWithDivider,
  replaceBlockWithMedia,
  replaceBlockWithTable,
  resizeMediaGroupWidths,
  resizeTableGrid,
  renderInlineMarkdown,
  resolveMediaDragWidth,
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

function makeDataTransfer(parts: {
  data?: Record<string, string>;
  files?: File[];
  items?: Array<{ kind: string; type: string; file?: File }>;
  types?: string[];
}): DataTransfer {
  const data = parts.data ?? {};
  return {
    files: parts.files ?? [],
    items: (parts.items ?? []).map((item) => ({
      kind: item.kind,
      type: item.type,
      getAsFile: () => item.file ?? null
    })),
    types: parts.types ?? Object.keys(data),
    getData: (type: string) => data[type] ?? ""
  } as unknown as DataTransfer;
}

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

  it("parses and serializes resizable image and video blocks", () => {
    const markdown = [
      "![Diagrama](../.gravity-assets/diagrama.png){width=65% align=left}",
      "",
      "[Video: YouTube](https://youtu.be/dQw4w9WgXcQ){width=80% align=right}"
    ].join("\n");
    const blocks = parseMarkdown(markdown);

    expect(blocks.filter((block) => block.type !== "p")).toMatchObject([
      {
        alt: "Diagrama",
        source: "../.gravity-assets/diagrama.png",
        type: "image",
        width: 65,
        alignment: "left"
      },
      {
        source: "https://youtu.be/dQw4w9WgXcQ",
        type: "video",
        width: 80,
        alignment: "right"
      }
    ]);
    expect(serializeBlocks(blocks)).toBe(markdown);
    expect(normalizeMediaWidth(63.4)).toBe(63);
    expect(normalizeMediaAlignment(undefined)).toBe("center");
  });

  it("treats GIFs as resizable image blocks", () => {
    const markdown =
      "![Animación](../.gravity-assets/animation.gif){width=45% align=right}";
    const blocks = parseMarkdown(markdown);

    expect(blocks.find((block) => block.type === "image")).toMatchObject({
      alignment: "right",
      alt: "Animación",
      source: "../.gravity-assets/animation.gif",
      type: "image",
      width: 45
    });
    expect(serializeBlocks(blocks)).toBe(markdown);
  });

  it("round-trips media text wrapping and text alignment metadata", () => {
    const markdown = [
      "![Foto](../.gravity-assets/foto.png){width=45% align=left wrap=left}",
      "",
      "Texto que fluye junto a la imagen. {text-align=justify}"
    ].join("\n");
    const blocks = parseMarkdown(markdown);

    expect(blocks.find((block) => block.type === "image")).toMatchObject({
      alignment: "left",
      mediaWrap: "left",
      width: 45
    });
    expect(
      blocks.find(
        (block) =>
          block.type === "p" &&
          block.text === "Texto que fluye junto a la imagen."
      )
    ).toMatchObject({ textAlignment: "justify" });
    expect(serializeBlocks(blocks)).toBe(markdown);
    expect(normalizeMediaWrap(undefined)).toBe("none");
    expect(normalizeTextAlignment("center")).toBe("center");
  });

  it("anchors a dragged media block before text and turns on side wrap", () => {
    const blocks = parseMarkdown(
      [
        "Un párrafo larguísimo que debería fluir junto a la imagen.",
        "",
        "![Foto](https://cdn.example.com/foto.png){width=100%}"
      ].join("\n")
    );
    const image = blocks.find((block) => block.type === "image");
    const paragraph = blocks.find(
      (block) => block.type === "p" && block.text.startsWith("Un párrafo")
    );

    const next = anchorMediaToBlock(
      blocks,
      image?.id ?? "",
      paragraph?.id ?? "",
      "left"
    );
    const imageIndex = next.findIndex((block) => block.type === "image");
    const paragraphIndex = next.findIndex(
      (block) => block.type === "p" && block.text.startsWith("Un párrafo")
    );

    // The media is re-anchored ABOVE the text so the float wraps it, with a
    // sensible default width and side alignment.
    expect(imageIndex).toBeGreaterThanOrEqual(0);
    expect(imageIndex).toBeLessThan(paragraphIndex);
    expect(next[imageIndex]).toMatchObject({
      alignment: "left",
      mediaWrap: "left",
      width: 48
    });

    // A narrower image keeps its width instead of snapping to the default.
    const narrow = anchorMediaToBlock(
      blocks.map((block) =>
        block.type === "image" ? { ...block, width: 35 } : block
      ),
      image?.id ?? "",
      paragraph?.id ?? "",
      "right"
    );
    expect(narrow.find((block) => block.type === "image")).toMatchObject({
      mediaWrap: "right",
      width: 35
    });

    // Dropping onto an empty paragraph (no text to wrap) is a no-op.
    const emptyParagraph = blocks.find(
      (block) => block.type === "p" && !block.text.trim()
    );
    expect(
      anchorMediaToBlock(
        blocks,
        image?.id ?? "",
        emptyParagraph?.id ?? "",
        "left"
      )
    ).toEqual(blocks);
  });

  it("accepts secure pasted image URLs without accepting unsafe protocols", () => {
    expect(
      normalizePastedImageUrl("https://cdn.example.com/reaction.gif")
    ).toBe("https://cdn.example.com/reaction.gif");
    expect(normalizePastedImageUrl("http://cdn.example.com/reaction.gif")).toBe(
      null
    );
    expect(normalizePastedImageUrl("javascript:alert(1)")).toBeNull();
  });

  it("detects droppable and pasteable image payloads across transfer formats", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "captura.png", {
      type: "image/png"
    });

    // A file (filesystem drag or copied bytes) wins over everything else.
    expect(
      clipboardImageSource(
        makeDataTransfer({
          data: { "text/html": '<img src="https://i.pinimg.com/decoy.jpg">' },
          files: [png]
        })
      )
    ).toBe(png);

    // Images copied from a browser arrive as a clipboard item, not in `files`.
    expect(
      clipboardImageSource(
        makeDataTransfer({
          items: [{ kind: "file", type: "image/png", file: png }]
        })
      )
    ).toBe(png);

    // Pinterest-style copy: an <img> embedded in the HTML fragment.
    expect(
      clipboardImageSource(
        makeDataTransfer({
          data: {
            "text/html": '<meta><img src="https://i.pinimg.com/cat.jpg">'
          }
        })
      )
    ).toBe("https://i.pinimg.com/cat.jpg");

    // Dragging an image out of a browser yields a text/uri-list payload.
    expect(
      clipboardImageSource(
        makeDataTransfer({
          data: {
            "text/uri-list": "# comment\nhttps://cdn.example.com/meme.webp"
          }
        })
      )
    ).toBe("https://cdn.example.com/meme.webp");

    // Inline data URIs paste straight through.
    expect(
      clipboardImageSource(
        makeDataTransfer({
          data: { "text/plain": "data:image/png;base64,AAAA" }
        })
      )
    ).toBe("data:image/png;base64,AAAA");

    // Plain text is never treated as an image.
    expect(
      clipboardImageSource(
        makeDataTransfer({ data: { "text/plain": "solo texto" } })
      )
    ).toBeNull();
  });

  it("recognizes file and url drags but leaves plain text drags to the browser", () => {
    expect(dataTransferHasImage(makeDataTransfer({ types: ["Files"] }))).toBe(
      true
    );
    expect(
      dataTransferHasImage(makeDataTransfer({ types: ["text/uri-list"] }))
    ).toBe(true);
    // A text selection drag (no file/url) must not be hijacked as an image.
    expect(
      dataTransferHasImage(
        makeDataTransfer({ types: ["text/plain", "text/html"] })
      )
    ).toBe(false);
    expect(dataTransferHasImage(makeDataTransfer({ types: [] }))).toBe(false);
    expect(dataTransferHasImage(null)).toBe(false);
  });

  it("round-trips grouped media as one editor row", () => {
    const markdown = [
      "![Uno](../.gravity-assets/uno.png){width=50% group=gallery-a}",
      "",
      "[Video: YouTube](https://youtu.be/abc123){width=50% group=gallery-a}"
    ].join("\n");
    const blocks = parseMarkdown(markdown);
    const units = buildEditorUnits(blocks);

    expect(blocks.map((block) => block.type)).toEqual([
      "p",
      "image",
      "video",
      "p"
    ]);
    expect(units[1]?.blocks).toHaveLength(2);
    expect(serializeBlocks(blocks)).toBe(markdown);
  });

  it("groups media laterally and limits a row to four items", () => {
    const media = (
      id: string
    ): Parameters<typeof groupMediaBlocks>[0][number] => ({
      alignment: "center",
      alt: id,
      id,
      source: `https://cdn.example.com/${id}.png`,
      text: "",
      type: "image",
      width: 100
    });
    let blocks = [media("one"), media("two"), media("three"), media("four")];

    blocks = groupMediaBlocks(blocks, "two", "one", "right", "gallery-a");
    blocks = groupMediaBlocks(blocks, "three", "two", "right", "gallery-b");
    blocks = groupMediaBlocks(blocks, "four", "three", "right", "gallery-c");

    const grouped = blocks.filter((block) => block.mediaGroup);
    expect(grouped.map((block) => block.id)).toEqual([
      "one",
      "two",
      "three",
      "four"
    ]);
    expect(grouped.every((block) => block.width === 25)).toBe(true);

    const fifth = media("five");
    const unchanged = groupMediaBlocks(
      [...blocks, fifth],
      "five",
      "four",
      "right",
      "gallery-d"
    );
    expect(unchanged.find((block) => block.id === "five")?.mediaGroup).toBe(
      undefined
    );
  });

  it("redistributes grouped media widths while preserving the row", () => {
    const widths = resizeMediaGroupWidths([25, 25, 25, 25], 0, 55);

    expect(widths[0]).toBe(55);
    expect(widths.slice(1)).toEqual([15, 15, 15]);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(100);
  });

  it("detaches a dragged item and dissolves a one-item media group", () => {
    const blocks = [
      { id: "top", type: "p" as const, text: "Arriba" },
      {
        alignment: "center" as const,
        alt: "Uno",
        id: "one",
        mediaGroup: "gallery-a",
        source: "https://cdn.example.com/one.png",
        text: "",
        type: "image" as const,
        width: 50
      },
      {
        alignment: "center" as const,
        alt: "Dos",
        id: "two",
        mediaGroup: "gallery-a",
        source: "https://cdn.example.com/two.png",
        text: "",
        type: "image" as const,
        width: 50
      },
      { id: "bottom", type: "p" as const, text: "Abajo" }
    ];

    const moved = moveBlockWithWritingBoundaries(blocks, "two", blocks.length);

    expect(
      moved.find((block) => block.id === "one")?.mediaGroup
    ).toBeUndefined();
    expect(moved.find((block) => block.id === "one")?.width).toBe(100);
    expect(
      moved.find((block) => block.id === "two")?.mediaGroup
    ).toBeUndefined();
    expect(moved.find((block) => block.id === "two")?.width).toBe(100);
  });

  it("keeps writable paragraphs above and below inserted media", () => {
    const blocks = replaceBlockWithMedia(
      [{ id: "command", type: "p", text: "/video" }],
      "command",
      {
        alignment: "center",
        alt: "YouTube",
        id: "video",
        source: "https://youtu.be/abc123",
        text: "",
        type: "video",
        width: 100
      }
    );

    expect(blocks.map((block) => block.type)).toEqual(["p", "video", "p"]);
    expect(blocks[1]?.id).toBe("command");
  });

  it("exposes insertion zones above and below an image", () => {
    const blocks = parseMarkdown(
      "![Animación](../.gravity-assets/animation.gif){width=80%}"
    );

    expect(blocks.map((block) => block.type)).toEqual(["p", "image", "p"]);
    expect(getMediaInserterPosition(blocks, 0)).toBe("before");
    expect(getMediaInserterPosition(blocks, 2)).toBe("after");

    const markup = renderToStaticMarkup(
      createElement(BlockEditor, {
        onChange: vi.fn(),
        value: "![Animación](https://cdn.example.com/animation.gif){width=80%}"
      })
    );
    expect(markup).toContain('data-media-inserter-position="before"');
    expect(markup).toContain('data-media-inserter-position="after"');
    expect(markup).toContain('aria-label="Escribir después del bloque"');
  });

  it("restores writable paragraphs when media is moved to either edge", () => {
    const blocks = ensureStructuralWritingBlocks([
      { id: "top", type: "p", text: "Arriba" },
      {
        alignment: "center",
        alt: "YouTube",
        id: "video",
        source: "https://youtu.be/abc123",
        text: "",
        type: "video",
        width: 75
      },
      { id: "bottom", type: "p", text: "Abajo" }
    ]);

    const first = moveBlockWithWritingBoundaries(blocks, "video", 0);
    const last = moveBlockWithWritingBoundaries(blocks, "video", blocks.length);

    expect(first.slice(0, 3).map((block) => block.type)).toEqual([
      "p",
      "video",
      "p"
    ]);
    expect(last.slice(-3).map((block) => block.type)).toEqual([
      "p",
      "video",
      "p"
    ]);
  });

  it("collapses empty media boundaries without deleting the media", () => {
    const result = deleteEmptyBlock(
      [
        {
          alignment: "center",
          alt: "YouTube",
          id: "video",
          source: "https://youtu.be/abc123",
          text: "",
          type: "video",
          width: 75
        },
        { id: "inserter", type: "p", text: "" }
      ],
      "inserter",
      { id: "fallback", type: "p", text: "" }
    );
    const blocks = ensureStructuralWritingBlocks(result.blocks);

    expect(blocks.map((block) => block.type)).toEqual(["p", "video", "p"]);
    expect(blocks.some((block) => block.id === "video")).toBe(true);
  });

  it("resizes media from the corner according to its alignment", () => {
    expect(
      resolveMediaDragWidth({
        alignment: "left",
        containerWidth: 500,
        edge: "right",
        pointerX: 500,
        startPointerX: 400,
        startWidth: 60
      })
    ).toBe(80);
    expect(
      resolveMediaDragWidth({
        alignment: "right",
        containerWidth: 500,
        edge: "left",
        pointerX: 300,
        startPointerX: 400,
        startWidth: 60
      })
    ).toBe(80);
    expect(
      resolveMediaDragWidth({
        alignment: "center",
        containerWidth: 500,
        edge: "right",
        pointerX: 410,
        startPointerX: 400,
        startWidth: 60
      })
    ).toBe(64);
  });

  it("renders corner resizing and a discreet media options handle", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockEditor, {
        onChange: vi.fn(),
        value:
          "[Video: YouTube](https://youtu.be/abc123){width=70% align=center}"
      })
    );

    expect(
      markup.match(/aria-label="Redimensionar video desde la esquina/g)
    ).toHaveLength(2);
    // The arrange controls now live behind a single discreet corner grip; the
    // wrap/align/size options only mount in the popover once it is opened.
    expect(markup).toContain('aria-label="Opciones de video"');
    expect(markup).toContain("media-block__handle");
    expect(markup).not.toContain('aria-label="Alinear video a la izquierda"');
    expect(markup).not.toContain("media-block__alignment");
    expect(markup).not.toContain("media-block__wrap");
    expect(markup.match(/data-media-inserter="true"/g)).toHaveLength(2);
    expect(markup).not.toContain("media-block__resize-handle");
    expect(markup).not.toContain('type="range"');
  });

  it("renders wrapped media and aligned text as persisted block behavior", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockEditor, {
        onChange: vi.fn(),
        value: [
          "![Foto](https://cdn.example.com/foto.png){width=40% align=right wrap=right}",
          "",
          "Texto alrededor. {text-align=center}"
        ].join("\n")
      })
    );

    expect(markup).toContain("is-media-wrap is-wrap-right");
    expect(markup).toContain('style="width:40%"');
    expect(markup).toContain('data-text-alignment="center"');
    expect(markup).toContain("text-align:center");
  });

  it("renders grouped media in one flexible row", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockEditor, {
        onChange: vi.fn(),
        value: [
          "![Uno](https://cdn.example.com/one.png){width=50% group=gallery-a}",
          "[Video: YouTube](https://youtu.be/abc123){width=50% group=gallery-a}"
        ].join("\n")
      })
    );

    expect(markup).toContain("media-row");
    expect(markup).toContain('data-media-block-id="');
    expect(markup).not.toContain('aria-label="Alinear imagen"');
  });

  it("accepts supported HTTPS video providers and rejects unsafe URLs", () => {
    expect(normalizeVideoSource("https://youtube.com/watch?v=abc123")).toEqual({
      embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
      kind: "embed",
      provider: "YouTube"
    });
    expect(normalizeVideoSource("https://vimeo.com/123456")).toMatchObject({
      kind: "embed",
      provider: "Vimeo"
    });
    expect(normalizeVideoSource("https://cdn.example.com/demo.mp4")).toEqual({
      embedUrl: "https://cdn.example.com/demo.mp4",
      kind: "direct",
      provider: "Video"
    });
    expect(normalizeVideoSource("http://youtube.com/watch?v=abc")).toBeNull();
    expect(normalizeVideoSource("javascript:alert(1)")).toBeNull();
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
    expect(
      inlineMarkdownToPlainText(
        "![Diagrama](../.gravity-assets/diagrama.png){width=65% align=left}\n[Video: YouTube](https://youtu.be/abc){width=80% align=right}"
      )
    ).toBe("\n");
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

    // Code is structural, so it is wrapped with writable paragraphs without
    // changing the serialized markdown.
    expect(blocks.map((block) => block.type)).toEqual(["p", "code", "p"]);
    expect(blocks[1]).toMatchObject({
      type: "code",
      language: "typescript",
      text: 'const greeting: string = "hola";\nconsole.log(greeting);'
    });
    expect(serializeBlocks(blocks)).toBe(markdown);
  });

  it("keeps a terminal code block writable above and below", () => {
    const blocks = parseMarkdown("Arriba\n\n```javascript\nconst a = 1;\n```");

    expect(blocks.map((block) => block.type)).toEqual(["p", "code", "p"]);
    expect(serializeBlocks(blocks)).toBe(
      "Arriba\n\n```javascript\nconst a = 1;\n```"
    );
  });

  it("exposes click-to-write zones around code, tables and dividers", () => {
    for (const markup of [
      "```js\nx\n```",
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
      "---"
    ]) {
      const blocks = parseMarkdown(markup);
      const structuralIndex = blocks.findIndex((block) =>
        ["code", "table", "divider"].includes(block.type)
      );
      // Empty paragraphs immediately before/after a structural block collapse
      // into the clickable continue-writing strip.
      expect(getMediaInserterPosition(blocks, structuralIndex - 1)).toBe(
        "before"
      );
      expect(getMediaInserterPosition(blocks, structuralIndex + 1)).toBe(
        "after"
      );
    }
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
