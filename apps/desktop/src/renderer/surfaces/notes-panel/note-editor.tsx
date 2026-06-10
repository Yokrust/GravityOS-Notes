import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BlockEditor } from "../../components/BlockEditor.js";
import { useStore } from "../../lib/store.js";
import type { FileNode } from "../../lib/types.js";

function formatRelative(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NoteEditor() {
  const {
    activeNote,
    addNote,
    chooseNotebookRoot,
    notebookRoot,
    notesLoading,
    renameNode,
    tree,
    updateContent
  } = useStore();
  const [title, setTitle] = useState(activeNote?.name ?? "");
  const [content, setContent] = useState(activeNote?.content ?? "");
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeNote) return;
    if (lastIdRef.current !== activeNote.id) {
      setTitle(activeNote.name);
      setContent(activeNote.content ?? "");
      lastIdRef.current = activeNote.id;
    }
  }, [activeNote]);

  useEffect(() => {
    if (!activeNote) return;
    const timeoutId = window.setTimeout(() => {
      if (content !== activeNote.content) {
        updateContent(activeNote.id, content);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeNote, content, updateContent]);

  useEffect(() => {
    if (!activeNote) return;
    const timeoutId = window.setTimeout(() => {
      const trimmedTitle = title.trim();
      if (trimmedTitle && trimmedTitle !== activeNote.name) {
        renameNode(activeNote.id, trimmedTitle);
      }
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeNote, renameNode, title]);

  const stats = useMemo(() => {
    const plain = content.replace(/[[\]#>*`-]/g, "");
    const words = plain.trim() ? plain.trim().split(/\s+/).length : 0;
    return {
      chars: plain.length,
      words
    };
  }, [content]);
  const noteEntries = useMemo(() => collectNotes(tree), [tree]);
  const activeEntry = noteEntries.find(
    (entry) => entry.node.id === activeNote?.id
  );
  const folio = Math.max(
    1,
    noteEntries.findIndex((entry) => entry.node.id === activeNote?.id) + 1
  )
    .toString()
    .padStart(2, "0");

  if (!activeNote) {
    return (
      <div className="note-empty-state">
        <div className="note-empty-index">00</div>
        <div>
          <h1>
            {notesLoading
              ? "Leyendo cuaderno"
              : notebookRoot
                ? "Selecciona una nota"
                : "Abre tu carpeta de notas"}
          </h1>
          <p>
            {notebookRoot
              ? "Elige un archivo Markdown del árbol o crea una nota nueva."
              : "Gravity reflejará sus carpetas y archivos .md sin importar ni duplicar contenido."}
          </p>
          <button
            onClick={notebookRoot ? () => addNote() : chooseNotebookRoot}
            type="button"
          >
            <Plus size={14} />
            {notebookRoot ? "Nueva nota" : "Elegir carpeta"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="note-editor-shell">
      <div className="note-editor-scroll scroll-thin">
        <div className="note-document">
          <aside aria-label="Detalles de la nota" className="note-folio">
            <div className="folio-number">{folio}</div>
            <div className="folio-rule" />
            <div className="folio-label">Notebook</div>
            <div className="folio-path">
              {activeEntry?.path.join(" / ") ?? activeNote.name}
            </div>
          </aside>

          <div className="note-page">
            <header className="note-header">
              <div className="note-date">
                {new Date(
                  activeNote.updatedAt ?? Date.now()
                ).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                })}
              </div>
              <input
                aria-label="Título de la nota"
                className="note-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Sin título"
                value={title}
              />

              <div className="note-meta">
                <span>
                  {activeNote.updatedAt
                    ? formatRelative(activeNote.updatedAt)
                    : "ahora"}
                </span>
                <span>{stats.words} palabras</span>
                <span>{stats.chars} caracteres</span>
              </div>
            </header>

            <div className="editor note-editor-content">
              <BlockEditor
                key={activeNote.id}
                onChange={setContent}
                value={content}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function collectNotes(
  nodes: FileNode[],
  parents: string[] = []
): Array<{ node: FileNode; path: string[] }> {
  return nodes.flatMap((node) => {
    if (node.type === "note") {
      return [{ node, path: [...parents, node.name] }];
    }

    return collectNotes(node.children ?? [], [...parents, node.name]);
  });
}
