import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  BlockEditor,
  inlineMarkdownToPlainText
} from "../../components/BlockEditor.js";
import { dateLocale, getLanguage, t } from "../../lib/i18n.js";
import {
  autocorrectInputElement,
  correctSpanishText
} from "../../lib/spanish-accents.js";
import { useStore } from "../../lib/store.js";

function formatRelative(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("ahora");
  if (minutes < 60) return t("hace {n} min", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hace {n} h", { n: hours });
  const days = Math.floor(hours / 24);
  return t("hace {n} d", { n: days });
}

export function NoteEditor() {
  const {
    activeNote,
    addNote,
    chooseNotebookRoot,
    notebookRoot,
    notesLoading,
    renameNode,
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
    const plain = inlineMarkdownToPlainText(content).replace(
      /[[\]#>*`+=~{}-]/g,
      ""
    );
    const words = plain.trim() ? plain.trim().split(/\s+/).length : 0;
    return {
      chars: plain.length,
      words
    };
  }, [content]);

  if (!activeNote) {
    return (
      <div className="note-empty-state">
        <div className="note-empty-index">00</div>
        <div>
          <h1>
            {notesLoading
              ? t("Leyendo cuaderno")
              : notebookRoot
                ? t("Selecciona una nota")
                : t("Abre tu carpeta de notas")}
          </h1>
          <p>
            {notebookRoot
              ? t("Elige una nota del árbol o crea una nueva.")
              : t("Conecta una carpeta y empieza a escribir.")}
          </p>
          <button
            onClick={notebookRoot ? () => addNote() : chooseNotebookRoot}
            type="button"
          >
            <Plus size={14} />
            {notebookRoot ? t("Nueva nota") : t("Elegir carpeta")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="note-editor-shell">
      <div className="note-editor-scroll scroll-thin">
        {/* key por nota: re-monta el documento y dispara la animación de entrada */}
        <div className="note-document" key={activeNote.id}>
          <div className="note-page">
            <header className="note-header">
              <div className="note-date">
                {new Date(
                  activeNote.updatedAt ?? Date.now()
                ).toLocaleDateString(dateLocale(), {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                })}
              </div>
              <input
                aria-label={t("Título de la nota")}
                className="note-title"
                onBlur={(event) => {
                  if (getLanguage() === "es") {
                    setTitle(correctSpanishText(event.target.value));
                  }
                }}
                onChange={(event) =>
                  setTitle(
                    getLanguage() === "es"
                      ? autocorrectInputElement(event.target)
                      : event.target.value
                  )
                }
                placeholder={t("Sin título")}
                value={title}
              />

              <div className="note-meta">
                <span>
                  {activeNote.updatedAt
                    ? formatRelative(activeNote.updatedAt)
                    : t("ahora")}
                </span>
                <span>{t("{count} palabras", { count: stats.words })}</span>
                <span>{t("{count} caracteres", { count: stats.chars })}</span>
              </div>
            </header>

            <div className="editor note-editor-content">
              <BlockEditor
                key={activeNote.id}
                importImagePath={(sourcePath) =>
                  window.gravity.importNotebookImagePath(
                    activeNote.path,
                    sourcePath
                  )
                }
                loadImage={(source) =>
                  window.gravity.loadNotebookImage(activeNote.path, source)
                }
                onChange={setContent}
                onChooseImage={() =>
                  window.gravity.chooseNotebookImage(activeNote.path)
                }
                onPasteImage={(input) =>
                  input.kind === "url"
                    ? window.gravity.importNotebookImageUrl(
                        activeNote.path,
                        input.source
                      )
                    : window.gravity.saveNotebookImage(activeNote.path, input)
                }
                readTextAsset={(assetPath) =>
                  window.gravity
                    .readNotebookTextAsset(assetPath)
                    .then((asset) => asset.content)
                }
                value={content}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
