"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Calendar, Sparkles, StickyNote, Timer, X } from "lucide-react";
import type { SatelliteKind } from "@/lib/types";
import { useStore } from "@/lib/store";
import { canvasRef } from "@/lib/canvas-ref";

interface SatelliteMeta {
  kind: SatelliteKind;
  title: string;
  desc: string;
  icon: React.ReactNode;
  dotColor: string;
  accent: string;
}

const SATELLITES: SatelliteMeta[] = [
  {
    kind: "quick-note",
    title: "Quick Note",
    desc: "Idea al vuelo",
    icon: <StickyNote size={15} />,
    dotColor: "#E7B94C",
    accent: "from-amber-200/70 to-amber-50/40",
  },
  {
    kind: "calendar",
    title: "Calendario",
    desc: "Mes de un vistazo",
    icon: <Calendar size={15} />,
    dotColor: "#6DA3D8",
    accent: "from-sky-200/70 to-sky-50/40",
  },
  {
    kind: "pomodoro",
    title: "Pomodoro",
    desc: "Foco en intervalos",
    icon: <Timer size={15} />,
    dotColor: "#D76B73",
    accent: "from-rose-200/70 to-rose-50/40",
  },
];

interface DragState {
  kind: SatelliteKind;
  meta: SatelliteMeta;
  x: number;
  y: number;
}

const DragContext = { current: null as null | ((d: DragState | null) => void) };

export function SatelliteHubButton() {
  const { hubOpen, toggleHub, setHub, spawnSatellite } = useStore();
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    dragRef.current = drag;
    DragContext.current = setDrag;
  }, [drag]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) =>
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const onUp = (e: PointerEvent) => {
      const current = dragRef.current;
      if (current) {
        const el = canvasRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          // Always spawn — the store clamps out-of-bounds drops to the
          // nearest valid position so nothing is ever lost to the user.
          spawnSatellite(
            current.kind,
            e.clientX - r.left,
            e.clientY - r.top,
          );
        }
      }
      setDrag(null);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [drag, spawnSatellite]);

  const startDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    meta: SatelliteMeta,
  ) => {
    setDrag({
      kind: meta.kind,
      meta,
      x: e.clientX,
      y: e.clientY,
    });
    setHub(false);
  };

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={toggleHub}
        className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition ${
          hubOpen
            ? "bg-[color:var(--ink)] text-[color:var(--bg-paper)]"
            : "text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)]"
        }`}
      >
        <motion.span
          animate={{ rotate: hubOpen ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          {hubOpen ? <X size={12} /> : <Sparkles size={12} />}
        </motion.span>
        <span>Satélites</span>
        <span
          className={`inline-flex gap-[3px] ${hubOpen ? "opacity-90" : "opacity-70"}`}
        >
          {SATELLITES.map((s) => (
            <span
              key={s.kind}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: s.dotColor }}
            />
          ))}
        </span>
      </motion.button>

      <AnimatePresence>
        {hubOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 mt-2 w-[320px] rounded-[var(--radius-lg)] p-2 z-40"
          >
            <div className="px-3 pt-2 pb-2 border-b border-[color:var(--line)] flex items-baseline justify-between">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Satélites
              </div>
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              {SATELLITES.map((s, i) => (
                <motion.button
                  key={s.kind}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.04 + i * 0.05,
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onPointerDown={(e) => startDrag(e, s)}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-[color:var(--accent-soft)] transition cursor-grab active:cursor-grabbing touch-none select-none"
                >
                  <span
                    className={`relative grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br ${s.accent} text-[color:var(--ink)] border border-[color:var(--line)]`}
                  >
                    {s.icon}
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.dotColor }}
                    />
                  </span>
                  <span className="flex flex-col text-left leading-tight">
                    <span className="font-display text-[14px] font-semibold">
                      {s.title}
                    </span>
                    <span className="text-[11.5px] text-[color:var(--faint)] font-mono">
                      {s.desc}
                    </span>
                  </span>
                  <span className="ml-auto text-[10.5px] text-[color:var(--faint)] font-mono opacity-0 group-hover:opacity-100 transition">
                    drag →
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="px-3 pt-2 pb-1 text-[10.5px] text-[color:var(--faint)] font-mono border-t border-[color:var(--line)] mt-1 flex items-center justify-between">
              <span>Pin &amp; float</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {drag && typeof document !== "undefined"
        ? createPortal(<DragGhost drag={drag} />, document.body)
        : null}
    </div>
  );
}

function DragGhost({ drag }: { drag: DragState }) {
  // Minimal dark capsule that mirrors the satellite toolbar — keeps the
  // transition from ghost → placed satellite calm and continuous instead
  // of swapping a colorful pill for a black panel.
  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        left: drag.x,
        top: drag.y,
        transform: "translate(-32px, -16px)",
        zIndex: 100,
        pointerEvents: "none",
      }}
      className="satellite-shell flex items-center gap-2 rounded-[14px] px-2.5 py-1.5"
    >
      <span className="sat-icon-btn" data-active="true">
        {drag.meta.icon}
      </span>
      <span className="sat-title pr-1">{drag.meta.title}</span>
    </motion.div>
  );
}

/** Back-compat: allow existing imports of <SatelliteHub /> to still work. */
export function SatelliteHub() {
  return null;
}
