import {
  ChevronRight,
  FileText,
  Folder,
  FolderCog,
  FolderPlus,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { SurfaceSwitcher } from "../../components/SurfaceSwitcher.js";
import type { AppSurface } from "../../lib/app-surface.js";
import { useStore } from "../../lib/store.js";
import type { FileNode } from "../../lib/types.js";

function NodeItem({ depth, node }: { node: FileNode; depth: number }) {
  const {
    activeNoteId,
    addFolder,
    addNote,
    deleteNode,
    expandedFolders,
    selectNote,
    sidebarOpen,
    toggleFolder,
    toggleSidebar
  } = useStore();
  const [hover, setHover] = useState(false);

  if (node.type === "folder") {
    const isOpen = expandedFolders[node.id];
    return (
      <div>
        <div
          className="note-tree-folder"
          onClick={() => toggleFolder(node.id)}
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
          <span className="note-tree-name">{node.name}</span>
          <span
            className={`note-tree-row-actions ${
              hover ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              className="note-tree-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                addNote(node.id);
              }}
              title="Nueva nota aquí"
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
              title="Nueva carpeta aquí"
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
                    `¿Eliminar la carpeta "${node.name}" y todo su contenido?`
                  )
                ) {
                  deleteNode(node.id);
                }
              }}
              title="Eliminar carpeta"
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

  const isActive = node.id === activeNoteId;
  return (
    <motion.div
      className={`note-tree-note ${isActive ? "is-active" : ""}`}
      onClick={() => {
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
      <span className="note-tree-name">{node.name}</span>
      {hover ? (
        <button
          className="note-tree-icon-button"
          onClick={(event) => {
            event.stopPropagation();
            if (window.confirm(`¿Eliminar la nota "${node.name}"?`)) {
              deleteNode(node.id);
            }
          }}
          title="Eliminar"
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
    <aside aria-label="Árbol de notas" className="notes-sidebar">
      <div className="notes-sidebar-navigation">
        <SurfaceSwitcher
          activeSurface={activeSurface}
          onSelectSurface={onSelectSurface}
        />
        <button
          aria-label="Cerrar navegación"
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
            <div className="notebook-label">Cuaderno</div>
            <div className="notebook-title" title={notebookRoot ?? undefined}>
              {notebookName ?? "Sin carpeta"}
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
              <Plus size={13} /> <span>Nueva nota</span>
            </button>
            <button
              className="new-folder-button"
              onClick={() => addFolder()}
              title="Nueva carpeta"
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
            Elegir carpeta
          </button>
        )}

        <div className="note-tree scroll-thin">
          <div className="note-tree-header">
            <div className="note-tree-label">Archivos</div>
            {notebookRoot ? (
              <div className="note-tree-header-actions">
                <button
                  aria-label="Recargar árbol"
                  className="note-tree-icon-button"
                  disabled={notesLoading}
                  onClick={refreshNotebook}
                  title="Recargar cambios del disco"
                  type="button"
                >
                  <RefreshCw
                    className={notesLoading ? "animate-spin" : ""}
                    size={12}
                  />
                </button>
                <button
                  aria-label="Cambiar carpeta"
                  className="note-tree-icon-button"
                  onClick={chooseNotebookRoot}
                  title="Cambiar carpeta del cuaderno"
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
              La carpeta del cuaderno no está disponible.
            </div>
          ) : null}
          {notebookRoot && !notesLoading && tree.length === 0 ? (
            <div className="notebook-message">
              Esta carpeta todavía no contiene notas Markdown.
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
