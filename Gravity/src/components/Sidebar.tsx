"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import type { FileNode } from "@/lib/types";
import { useStore } from "@/lib/store";

function NodeItem({ node, depth }: { node: FileNode; depth: number }) {
  const {
    activeNoteId,
    expandedFolders,
    selectNote,
    toggleFolder,
    deleteNode,
    addNote,
  } = useStore();
  const [hover, setHover] = useState(false);

  if (node.type === "folder") {
    const open = expandedFolders[node.id];
    return (
      <div>
        <div
          className="group flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--ink)] cursor-pointer transition-colors"
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => toggleFolder(node.id)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.18 }}
            className="flex h-4 w-4 items-center justify-center text-[color:var(--faint)]"
          >
            <ChevronRight size={11} strokeWidth={2} />
          </motion.span>
          {open ? (
            <FolderOpen size={13} className="opacity-80" />
          ) : (
            <Folder size={13} className="opacity-80" />
          )}
          <span className="truncate font-medium tracking-tight">
            {node.name}
          </span>
          <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                addNote(node.id);
              }}
              className="p-1 rounded-md hover:bg-[color:var(--accent-soft)]"
              title="Nueva nota aquí"
            >
              <Plus size={11} />
            </button>
          </span>
        </div>
        <AnimatePresence initial={false}>
          {open && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {node.children.map((c) => (
                <NodeItem key={c.id} node={c} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const active = node.id === activeNoteId;
  return (
    <motion.div
      whileHover={{ x: 1 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => selectNote(node.id)}
      className={`group relative flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer text-[12.5px] transition-colors ${
        active
          ? "bg-[color:var(--accent-soft)] text-[color:var(--ink)]"
          : "text-[color:var(--muted)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--ink)]"
      }`}
      style={{ paddingLeft: 22 + depth * 12 }}
    >
      <FileText size={12} className={active ? "opacity-90" : "opacity-60"} />
      <span className="truncate flex-1">{node.name}</span>
      {hover && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Eliminar "${node.name}"?`)) deleteNode(node.id);
          }}
          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          title="Eliminar"
        >
          <Trash2 size={11} />
        </button>
      )}
      {active && (
        <motion.span
          layoutId="active-pill"
          className="absolute left-1 top-1/2 -translate-y-1/2 h-3.5 w-[2px] rounded-full bg-[color:var(--ink)]"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
    </motion.div>
  );
}

export function Sidebar() {
  const { tree, addNote, addFolder } = useStore();

  return (
    <div className="h-full w-[272px] flex flex-col bg-[color:var(--bg-paper)]/50 backdrop-blur-md">
      {/* Mini header / stats */}
      <div className="px-4 pt-4 pb-3 border-b border-[color:var(--line)]">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--faint)] font-mono">
          Cuaderno
        </div>
        <div className="mt-1 font-display text-[19px] font-semibold leading-none tracking-tight">
          Personal
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <button
          onClick={() => addNote()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full border border-[color:var(--line)] hover:border-[color:var(--line-strong)] hover:bg-[color:var(--accent-soft)] px-3 text-[12px] text-[color:var(--ink-2)] transition"
        >
          <Plus size={12} /> Nueva nota
        </button>
        <button
          onClick={() => addFolder()}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[color:var(--line)] hover:border-[color:var(--line-strong)] hover:bg-[color:var(--accent-soft)] text-[color:var(--ink-2)] transition"
          title="Nueva carpeta"
        >
          <Folder size={13} />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-4">
        <div className="px-2 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.22em] text-[color:var(--faint)] font-mono">
          Árbol
        </div>
        {tree.map((n) => (
          <NodeItem key={n.id} node={n} depth={0} />
        ))}
      </div>

    </div>
  );
}
