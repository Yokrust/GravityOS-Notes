"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Type } from "lucide-react";
import { useStore } from "@/lib/store";
import { BlockEditor } from "./BlockEditor";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function NoteEditor() {
  const { activeNote, updateContent, renameNode } = useStore();
  const [title, setTitle] = useState(activeNote?.name ?? "");
  const [content, setContent] = useState(activeNote?.content ?? "");
  const titleRef = useRef<HTMLInputElement | null>(null);
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
    const t = setTimeout(() => {
      if (content !== activeNote.content) updateContent(activeNote.id, content);
    }, 250);
    return () => clearTimeout(t);
  }, [content, activeNote, updateContent]);

  useEffect(() => {
    if (!activeNote) return;
    const t = setTimeout(() => {
      if (title.trim() && title !== activeNote.name)
        renameNode(activeNote.id, title.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [title, activeNote, renameNode]);

  const stats = useMemo(() => {
    const plain = content.replace(/[#>*`\-\[\]]/g, "");
    const words = plain.trim() ? plain.trim().split(/\s+/).length : 0;
    const chars = plain.length;
    return { words, chars };
  }, [content]);

  if (!activeNote) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-3xl tracking-tight font-semibold">
            Selecciona una nota
          </div>
          <div className="text-[color:var(--muted)] mt-2">
            o crea una nueva desde la barra lateral.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      <div className="flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-[760px] px-12 pt-12 pb-32">
          {/* Editorial eyebrow / section */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--faint)] font-mono mb-4">
            <span className="inline-block h-[1px] w-6 bg-[color:var(--line-strong)]" />
            Notebook entry
            <span className="opacity-60">·</span>
            <span>04-{new Date().getDate()}</span>
          </div>

          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sin título"
            className="w-full bg-transparent border-none outline-none font-display text-[52px] leading-[1.02] font-semibold tracking-[-0.03em] placeholder:text-[color:var(--faint)]"
          />

          <div className="mt-3 flex items-center gap-3 text-[11px] text-[color:var(--faint)] font-mono">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {activeNote.updatedAt
                ? formatRelative(activeNote.updatedAt)
                : "ahora"}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Type size={11} />
              {stats.words} palabras
            </span>
            <span>·</span>
            <span>{stats.chars} caracteres</span>
          </div>

          <div className="mt-8 editor">
            <BlockEditor
              key={activeNote.id}
              value={content}
              onChange={setContent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
