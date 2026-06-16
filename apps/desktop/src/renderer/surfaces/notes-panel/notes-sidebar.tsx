import {
  ChevronRight,
  File,
  FileText,
  Film,
  Folder,
  FolderCog,
  FolderPlus,
  FolderOpen,
  Image,
  Music,
  Plus,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";

import { SurfaceSwitcher } from "../../components/SurfaceSwitcher.js";
import type { AppSurface } from "../../lib/app-surface.js";
import { t } from "../../lib/i18n.js";
import {
  ASSET_DND_MIME,
  isDraggableMediaKind,
  type AssetDragPayload,
  type MediaKind
} from "../../lib/media-kind.js";
import { useStore } from "../../lib/store.js";
import type { FileNode } from "../../lib/types.js";

function AssetIcon({ mediaKind }: { mediaKind: MediaKind }) {
  if (mediaKind === "image") return <Image className="opacity-60" size={12} />;
  if (mediaKind === "video") return <Film className="opacity-60" size={12} />;
  if (mediaKind === "audio") return <Music className="opacity-60" size={12} />;
  if (mediaKind === "text")
    return <FileText className="opacity-60" size={12} />;
  return <File className="opacity-60" size={12} />;
}

export function normalizeInlineNodeName(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

export function EditableNodeName({
  name,
  onEditingChange,
  onRename
}: {
  name: string;
  onEditingChange?: (editing: boolean) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
  }, [editing]);

  const setEditingState = (next: boolean) => {
    setEditing(next);
    onEditingChange?.(next);
  };

  const beginEditing = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    cancelRef.current = false;
    setDraft(name);
    setEditingState(true);
  };

  const cancelEditing = () => {
    cancelRef.current = true;
    setDraft(name);
    setEditingState(false);
  };

  const commitEditing = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const normalized = normalizeInlineNodeName(draft);
    if (normalized && normalized !== name) onRename(normalized);
    setDraft(normalized ?? name);
    setEditingState(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commitEditing();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  if (!editing) {
    return (
      <span
        className="note-tree-name"
        onDoubleClick={beginEditing}
        title={t("Doble clic para cambiar el nombre")}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      aria-label={t("Cambiar nombre de {name}", { name })}
      className="note-tree-name-input"
      onBlur={commitEditing}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      ref={inputRef}
      value={draft}
    />
  );
}

function NodeItem({ depth, node }: { node: FileNode; depth: number }) {
  const {
    activeNoteId,
    addFolder,
    addNote,
    deleteNode,
    expandedFolders,
    renameNode,
    selectNote,
    sidebarOpen,
    toggleFolder,
    toggleSidebar
  } = useStore();
  const [hover, setHover] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (node.type === "folder") {
    const isOpen = expandedFolders[node.id];
    return (
      <div>
        <div
          className={`note-tree-folder ${renaming ? "is-renaming" : ""}`}
          onClick={() => {
            if (!renaming) toggleFolder(node.id);
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ paddingLeft: 12 + depth * 16 }}
        >
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            className="note-tree-chevron"
            transition={{ duration: 0.18 }}
          >
            <ChevronRight size={11} strokeWidth={2} />
          </motion.span>
          {isOpen ? (
            <FolderOpen className="opacity-80" size={13} />
          ) : (
            <Folder className="opacity-80" size={13} />
          )}
          <EditableNodeName
            name={node.name}
            onEditingChange={setRenaming}
            onRename={(name) => renameNode(node.id, name)}
          />
          <span
            className={`note-tree-row-actions ${
              hover && !renaming
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              className="note-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                addNote(node.id);
              }}
              title={t("Nueva nota aquí")}
              type="button"
            >
              <Plus size={11} />
            </button>
            <button
              className="note-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                addFolder(node.id);
              }}
              title={t("Nueva carpeta aquí")}
              type="button"
            >
              <FolderPlus size={11} />
            </button>
            <button
              className="note-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                if (
                  window.confirm(
                    t('¿Eliminar la carpeta "{name}" y todo su contenido?', {
                      name: node.name
                    })
                  )
                ) {
                  deleteNode(node.id);
                }
              }}
              title={t("Eliminar carpeta")}
              type="button"
            >
              <Trash2 size={11} />
            </button>
          </span>
        </div>
        <AnimatePresence initial={false}>
          {isOpen && node.children ? (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {node.children.map((child) => (
                <NodeItem depth={depth + 1} key={child.id} node={child} />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  if (node.type === "asset") {
    const mediaKind: MediaKind = node.mediaKind ?? "file";
    const draggable = isDraggableMediaKind(mediaKind);
    return (
      <div
        className="note-tree-asset"
        draggable={draggable}
        onDragStart={
          draggable
            ? (event) => {
                const payload: AssetDragPayload = {
                  mediaKind,
                  name: node.name,
                  path: node.path
                };
                event.dataTransfer.setData(
                  ASSET_DND_MIME,
                  JSON.stringify(payload)
                );
                event.dataTransfer.setData("text/plain", node.name);
                event.dataTransfer.effectAllowed = "copy";
              }
            : undefined
        }
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ paddingLeft: 36 + depth * 16 }}
        title={draggable ? t("Arrastra a una nota para añadirlo") : node.name}
      >
        <AssetIcon mediaKind={mediaKind} />
        <span className="note-tree-name">{node.name}</span>
        {hover ? (
          <button
            className="note-tree-icon-button"
            onClick={(event) => {
              event.stopPropagation();
              if (
                window.confirm(t('¿Eliminar "{name}"?', { name: node.name }))
              ) {
                deleteNode(node.id);
              }
            }}
            title={t("Eliminar")}
            type="button"
          >
            <Trash2 size={11} />
          </button>
        ) : null}
      </div>
    );
  }

  const isActive = node.id === activeNoteId;
  return (
    <motion.div
      className={`note-tree-note ${isActive ? "is-active" : ""} ${
        renaming ? "is-renaming" : ""
      }`}
      onClick={() => {
        if (renaming) return;
        selectNote(node.id);
        if (sidebarOpen && window.matchMedia("(max-width: 760px)").matches) {
          toggleSidebar();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ paddingLeft: 36 + depth * 16 }}
    >
      <FileText className={isActive ? "opacity-90" : "opacity-60"} size={12} />
      <EditableNodeName
        name={node.name}
        onEditingChange={setRenaming}
        onRename={(name) => renameNode(node.id, name)}
      />
      {hover && !renaming ? (
        <button
          className="note-tree-icon-button"
          onClick={(event) => {
            event.stopPropagation();
            if (
              window.confirm(
                t('¿Eliminar la nota "{name}"?', { name: node.name })
              )
            ) {
              deleteNode(node.id);
            }
          }}
          title={t("Eliminar")}
          type="button"
        >
          <Trash2 size={11} />
        </button>
      ) : null}
      {isActive ? (
        <motion.span
          className="active-note-indicator"
          layoutId="active-note-indicator"
          transition={{ damping: 38, stiffness: 500, type: "spring" }}
        />
      ) : null}
    </motion.div>
  );
}

export function NotesSidebar({
  activeSurface,
  onSelectSurface
}: {
  activeSurface: AppSurface;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  const {
    addFolder,
    addNote,
    chooseNotebookRoot,
    notebookName,
    notebookRoot,
    notebookStatus,
    notesError,
    notesLoading,
    refreshNotebook,
    toggleSidebar,
    tree
  } = useStore();
  const noteCount = countNotes(tree);

  return (
    <aside aria-label={t("Árbol de notas")} className="notes-sidebar">
      <div className="notes-sidebar-navigation">
        <SurfaceSwitcher
          activeSurface={activeSurface}
          onSelectSurface={onSelectSurface}
        />
        <button
          aria-label={t("Cerrar navegación")}
          className="sidebar-close-button"
          onClick={toggleSidebar}
          type="button"
        >
          <X size={16} />
        </button>
      </div>

      <div className="notebook-panel">
        <div className="notebook-heading">
          <div>
            <div className="notebook-label">{t("Cuaderno")}</div>
            <div className="notebook-title" title={notebookRoot ?? undefined}>
              {notebookName ?? t("Sin carpeta")}
            </div>
          </div>
          <div className="notebook-count">
            {noteCount.toString().padStart(2, "0")}
          </div>
        </div>

        {notebookRoot ? (
          <div className="notebook-actions">
            <button
              className="new-note-button"
              onClick={() => addNote()}
              type="button"
            >
              <Plus size={13} /> <span>{t("Nueva nota")}</span>
            </button>
            <button
              className="new-folder-button"
              onClick={() => addFolder()}
              title={t("Nueva carpeta")}
              type="button"
            >
              <Folder size={13} />
            </button>
          </div>
        ) : (
          <button
            className="choose-notebook-button"
            onClick={chooseNotebookRoot}
            type="button"
          >
            <FolderCog size={14} />
            {t("Elegir carpeta")}
          </button>
        )}

        <div className="note-tree scroll-thin">
          <div className="note-tree-header">
            <div className="note-tree-label">{t("Archivos")}</div>
            {notebookRoot ? (
              <div className="note-tree-header-actions">
                <button
                  aria-label={t("Recargar árbol")}
                  className="note-tree-icon-button"
                  disabled={notesLoading}
                  onClick={refreshNotebook}
                  title={t("Recargar cambios del disco")}
                  type="button"
                >
                  <RefreshCw
                    className={notesLoading ? "animate-spin" : ""}
                    size={12}
                  />
                </button>
                <button
                  aria-label={t("Cambiar carpeta")}
                  className="note-tree-icon-button"
                  onClick={chooseNotebookRoot}
                  title={t("Cambiar carpeta del cuaderno")}
                  type="button"
                >
                  <FolderCog size={12} />
                </button>
              </div>
            ) : null}
          </div>

          {notesError ? (
            <div className="notebook-message is-error">{notesError}</div>
          ) : null}
          {notebookStatus && notebookStatus !== "ready" ? (
            <div className="notebook-message">
              {t("La carpeta del cuaderno no está disponible.")}
            </div>
          ) : null}
          {notebookRoot && !notesLoading && tree.length === 0 ? (
            <div className="notebook-message">
              {t("Esta carpeta todavía no contiene notas Markdown.")}
            </div>
          ) : null}
          {tree.map((node) => (
            <NodeItem depth={0} key={node.id} node={node} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function countNotes(nodes: FileNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total + (node.type === "note" ? 1 : countNotes(node.children ?? [])),
    0
  );
}
