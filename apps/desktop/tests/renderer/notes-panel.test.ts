import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StoreProvider } from "../../src/renderer/lib/store.js";
import { resolveSlashMenuPosition } from "../../src/renderer/components/BlockEditor.js";
import { NoteEditor } from "../../src/renderer/surfaces/notes-panel/note-editor.js";
import { NotesSidebar } from "../../src/renderer/surfaces/notes-panel/notes-sidebar.js";

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

  it("renders the notebook root onboarding inside the editor surface", () => {
    const markup = renderToStaticMarkup(
      createElement(StoreProvider, null, createElement(NoteEditor))
    );

    expect(markup).toContain("Leyendo cuaderno");
    expect(markup).toContain("archivos .md");
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
});
