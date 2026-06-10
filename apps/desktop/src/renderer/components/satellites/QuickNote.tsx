"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Files,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Type
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import { filterNotesByTitle, getLockedNoteIds } from "@/lib/quick-note-utils";
import type { QuickNote, Satellite } from "@/lib/types";

type FontSize = "sm" | "md" | "lg";
const FONT_SIZE_PX: Record<FontSize, number> = { sm: 12.5, md: 14, lg: 16 };

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function QuickNoteSatellite({ sat }: { sat: Satellite }) {
  const {
    quickNotes,
    satellites,
    createQuickNote,
    updateQuickNote,
    deleteQuickNote,
    setSatelliteMeta
  } = useStore();

  // Resolve which note this satellite is showing.
  const fallbackId = quickNotes[0]?.id ?? null;
  const initialId = sat.meta?.activeQuickNoteId ?? fallbackId;
  const note: QuickNote | undefined = useMemo(
    () => quickNotes.find((n) => n.id === initialId) ?? quickNotes[0],
    [quickNotes, initialId]
  );

  const [listOpen, setListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [size, setSize] = useState<FontSize>("md");
  const lockedNoteIds = useMemo(
    () => getLockedNoteIds(satellites, sat.id),
    [satellites, sat.id]
  );
  const visibleNotes = useMemo(
    () => filterNotesByTitle(quickNotes, searchQuery),
    [quickNotes, searchQuery]
  );
  const [draftTitle, setDraftTitle] = useState(note?.title ?? "Sin título");
  const [draftBody, setDraftBody] = useState(note?.content ?? "");
  const lastIdRef = useRef<string | null>(null);

  // When the active note changes, sync the editor drafts.
  useEffect(() => {
    if (!note) return;
    if (lastIdRef.current !== note.id) {
      setDraftTitle(note.title);
      setDraftBody(note.content);
      lastIdRef.current = note.id;
    }
  }, [note]);

  // Debounced autosave.
  useEffect(() => {
    if (!note) return;
    if (draftTitle === note.title && draftBody === note.content) return;
    const t = setTimeout(() => {
      updateQuickNote(note.id, { title: draftTitle, content: draftBody });
    }, 250);
    return () => clearTimeout(t);
  }, [draftTitle, draftBody, note, updateQuickNote]);

  const setActive = (id: string) => {
    setSatelliteMeta(sat.id, { activeQuickNoteId: id });
    setListOpen(false);
    setSearchQuery("");
  };

  const handleNew = () => {
    const id = createQuickNote();
    setSatelliteMeta(sat.id, { activeQuickNoteId: id });
    setListOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteQuickNote(id);
    if (id === note?.id) {
      const remaining = quickNotes.filter((n) => n.id !== id);
      if (remaining.length === 0) {
        const newId = createQuickNote();
        setSatelliteMeta(sat.id, { activeQuickNoteId: newId });
      } else {
        setSatelliteMeta(sat.id, { activeQuickNoteId: remaining[0]!.id });
      }
    }
  };

  const charCount = draftBody.length;
  const showTitle = draftTitle.trim() || "Sin título";

  return (
    <SatelliteShell
      sat={sat}
      title={showTitle}
      leftSlot={
        <>
          <button className="sat-icon-btn" data-active="true" title="Editar">
            <PencilLine size={13} strokeWidth={1.6} />
          </button>
          <button
            className="sat-icon-btn"
            data-active={listOpen ? "true" : "false"}
            onClick={() => {
              setListOpen((v) => !v);
              setSearchQuery("");
            }}
            title="Notas guardadas"
          >
            <Files size={13} strokeWidth={1.6} />
          </button>
          <button
            className="sat-icon-btn"
            onClick={handleNew}
            title="Nueva nota"
          >
            <Plus size={13} strokeWidth={1.7} />
          </button>
        </>
      }
      footerSlot={
        <>
          <span className="opacity-0">.</span>
          <span className="absolute left-1/2 -translate-x-1/2">
            {charCount} {charCount === 1 ? "carácter" : "caracteres"}
          </span>
          <button
            onClick={() =>
              setSize(size === "sm" ? "md" : size === "md" ? "lg" : "sm")
            }
            className="sat-icon-btn"
            title="Tamaño de texto"
          >
            <Type
              size={13}
              strokeWidth={1.6}
              style={{
                transform:
                  size === "sm"
                    ? "scale(0.85)"
                    : size === "lg"
                      ? "scale(1.15)"
                      : "scale(1)"
              }}
            />
          </button>
        </>
      }
    >
      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Editable title — sits inline above body for a single, calm column */}
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Título"
          className="bg-transparent outline-none px-4 pt-3 pb-1 text-[15px] font-medium tracking-tight text-[var(--sat-ink)]"
        />
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder="Empieza a escribir…"
          spellCheck={false}
          className="flex-1 resize-none bg-transparent outline-none border-none px-4 pb-4 pt-1 leading-[1.55] text-[var(--sat-ink)]"
          style={{ fontSize: FONT_SIZE_PX[size] }}
        />

        <AnimatePresence>
          {listOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-1 left-2 right-2 max-h-[70%] overflow-y-auto scroll-thin rounded-xl border border-[var(--sat-line-strong)] bg-[var(--sat-bg-2)]/95 backdrop-blur-md p-1 z-10"
            >
              <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--sat-faint)] font-mono">
                  Quick notes
                </span>
                <button
                  onClick={handleNew}
                  className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--sat-muted)] hover:text-[var(--sat-ink)] font-mono inline-flex items-center gap-1"
                >
                  <Plus size={11} /> nueva
                </button>
              </div>
              <div className="flex items-center gap-1.5 mx-1 mb-1 px-2 py-1 rounded-lg bg-black/20 border border-[var(--sat-line-strong)]">
                <Search
                  size={11}
                  strokeWidth={1.6}
                  className="text-[var(--sat-faint)] shrink-0"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="flex-1 bg-transparent outline-none text-[11.5px] text-[var(--sat-ink)] placeholder:text-[var(--sat-faint)]"
                />
              </div>
              <ul className="flex flex-col">
                {visibleNotes.map((n) => {
                  const active = n.id === note?.id;
                  const locked = lockedNoteIds.has(n.id);
                  return (
                    <li
                      key={n.id}
                      className={`group relative ${
                        locked ? "opacity-40 pointer-events-none" : ""
                      }`}
                      title={locked ? "Abierta en otra ventana" : undefined}
                    >
                      <button
                        onClick={locked ? undefined : () => setActive(n.id)}
                        disabled={locked}
                        className={`w-full text-left rounded-lg px-2 py-1.5 flex items-center gap-2 transition ${
                          active
                            ? "bg-white/8 text-[var(--sat-ink)]"
                            : locked
                              ? "text-[var(--sat-muted)] cursor-not-allowed"
                              : "text-[var(--sat-muted)] hover:bg-white/4 hover:text-[var(--sat-ink)]"
                        }`}
                      >
                        <FileText
                          size={12}
                          strokeWidth={1.6}
                          className="shrink-0 opacity-70"
                        />
                        <span className="flex-1 truncate text-[12.5px]">
                          {n.title.trim() || "Sin título"}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--sat-faint)] shrink-0">
                          {relativeTime(n.updatedAt)}
                        </span>
                      </button>
                      {!locked && quickNotes.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 sat-icon-btn opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          <Trash2 size={11} strokeWidth={1.6} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SatelliteShell>
  );
}
