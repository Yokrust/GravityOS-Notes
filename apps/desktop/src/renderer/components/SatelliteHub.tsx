"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Calendar, Plus, Sparkles, StickyNote, Timer, X } from "lucide-react";
import type { BuiltInSatelliteKind, SatelliteKind } from "@/lib/types";
import { useStore } from "@/lib/store";
import { canvasRef } from "@/lib/canvas-ref";
import {
  isSatelliteActive,
  isSatelliteGhosted
} from "@/lib/satellite-hub-utils";
import {
  CUSTOM_SATELLITE_COLORS,
  CustomSatelliteIcon
} from "@/lib/satellite-visuals";
import { SatelliteCreator } from "./SatelliteCreator";
import { CustomSatelliteErrorNotice } from "./CustomSatelliteErrorNotice";
import { findClosedCustomSatelliteInstance } from "@/lib/custom-satellite-lifecycle";

interface SatelliteMeta {
  kind: BuiltInSatelliteKind;
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
    accent: "from-amber-200/70 to-amber-50/40"
  },
  {
    kind: "calendar",
    title: "Calendario",
    desc: "Mes de un vistazo",
    icon: <Calendar size={15} />,
    dotColor: "#6DA3D8",
    accent: "from-sky-200/70 to-sky-50/40"
  },
  {
    kind: "pomodoro",
    title: "Pomodoro",
    desc: "Foco en intervalos",
    icon: <Timer size={15} />,
    dotColor: "#D76B73",
    accent: "from-rose-200/70 to-rose-50/40"
  }
];

type DragState = {
  x: number;
  y: number;
} & (
  | { source: "built-in"; kind: BuiltInSatelliteKind; meta: SatelliteMeta }
  | { source: "custom"; customType: CustomSatelliteTypeRecord }
);

const DragContext = { current: null as null | ((d: DragState | null) => void) };

export function SatelliteHubButton() {
  const {
    hubOpen,
    toggleHub,
    setHub,
    spawnSatellite,
    spawnCustomSatellite,
    focusSatellite,
    satellites,
    customSatelliteTypes,
    customSatelliteInstances,
    reopenCustomSatellite,
    pomodoroTimer,
    reminders,
    customSatelliteError,
    clearCustomSatelliteError
  } = useStore();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const now = Date.now();

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
          if (current.source === "built-in") {
            spawnSatellite(current.kind, e.clientX - r.left, e.clientY - r.top);
          } else {
            void spawnCustomSatellite(
              current.customType.id,
              e.clientX - r.left,
              e.clientY - r.top
            );
          }
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
  }, [drag, spawnCustomSatellite, spawnSatellite]);

  const startDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    meta: SatelliteMeta
  ) => {
    setDrag({
      source: "built-in",
      kind: meta.kind,
      meta,
      x: e.clientX,
      y: e.clientY
    });
    setHub(false);
  };

  const startCustomDrag = (
    e: React.PointerEvent<HTMLButtonElement>,
    customType: CustomSatelliteTypeRecord
  ) => {
    setDrag({
      source: "custom",
      customType,
      x: e.clientX,
      y: e.clientY
    });
    setHub(false);
  };

  const isActive = (kind: SatelliteKind) =>
    isSatelliteActive(kind, pomodoroTimer, reminders, now);

  const isGhosted = (kind: SatelliteKind) =>
    isSatelliteGhosted(kind, satellites);

  const recallSatellite = (kind: SatelliteKind) => {
    const existing = satellites.find((satellite) => satellite.kind === kind);
    if (existing) {
      focusSatellite(existing.id);
      setHub(false);
    }
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
            <motion.span
              key={s.kind}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: s.dotColor }}
              animate={
                isActive(s.kind)
                  ? { opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }
                  : { opacity: 0.5, scale: 1 }
              }
              transition={
                isActive(s.kind)
                  ? { repeat: Infinity, duration: 1.6, ease: "easeInOut" }
                  : { duration: 0.3 }
              }
            />
          ))}
        </span>
      </motion.button>
      {customSatelliteError &&
      !satellites.some(
        (satellite) =>
          satellite.kind === "custom" &&
          satellite.id === customSatelliteError.instanceId
      ) ? (
        <div className="custom-satellite-hub-error">
          <CustomSatelliteErrorNotice
            message={customSatelliteError.message}
            onDismiss={clearCustomSatelliteError}
          />
        </div>
      ) : null}

      <AnimatePresence>
        {hubOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-full mt-2 flex max-h-[calc(100vh-72px)] w-[320px] flex-col rounded-[var(--radius-lg)] p-2 z-40"
          >
            <div className="shrink-0 px-3 pt-2 pb-2 border-b border-[color:var(--line)] flex items-baseline justify-between">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Satélites
              </div>
            </div>
            <div className="scroll-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-0.5 pt-1">
                {SATELLITES.map((s, i) => {
                  const ghosted = isGhosted(s.kind);
                  const active = isActive(s.kind);
                  return (
                    <motion.button
                      key={s.kind}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: ghosted ? 0.45 : 1, x: 0 }}
                      transition={{
                        delay: 0.04 + i * 0.05,
                        duration: 0.28,
                        ease: [0.22, 1, 0.36, 1]
                      }}
                      whileHover={ghosted ? { opacity: 0.65 } : { x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={
                        ghosted ? () => recallSatellite(s.kind) : undefined
                      }
                      onPointerDown={
                        ghosted ? undefined : (e) => startDrag(e, s)
                      }
                      className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-[color:var(--accent-soft)] transition ${
                        ghosted
                          ? "cursor-pointer"
                          : "cursor-grab active:cursor-grabbing"
                      } touch-none select-none`}
                    >
                      <span
                        className={`relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-gradient-to-br ${s.accent} text-black`}
                      >
                        {s.icon}
                        <motion.span
                          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.dotColor }}
                          animate={
                            active
                              ? { opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }
                              : { opacity: 1, scale: 1 }
                          }
                          transition={
                            active
                              ? {
                                  repeat: Infinity,
                                  duration: 1.6,
                                  ease: "easeInOut"
                                }
                              : { duration: 0.3 }
                          }
                        />
                      </span>
                      <span className="flex flex-col text-left leading-tight">
                        <span className="font-display text-[14px] font-semibold">
                          {s.title}
                        </span>
                        <span className="text-[11.5px] text-[color:var(--faint)] font-mono">
                          {ghosted ? "ya abierto" : s.desc}
                        </span>
                      </span>
                      {!ghosted ? (
                        <span className="ml-auto text-[10.5px] text-[color:var(--faint)] font-mono opacity-0 group-hover:opacity-100 transition">
                          drag →
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
              <div className="mt-1 border-t border-[color:var(--line)] pt-1">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--faint)]">
                  My Satellites
                </div>
                {customSatelliteTypes.length === 0 ? (
                  <p className="px-3 pb-2 text-[11px] text-[color:var(--faint)]">
                    Aún no has creado Satellites.
                  </p>
                ) : (
                  customSatelliteTypes.map((customType, index) => {
                    const palette = CUSTOM_SATELLITE_COLORS[customType.color];
                    const closedInstance = findClosedCustomSatelliteInstance(
                      customSatelliteInstances,
                      customType.id
                    );
                    return (
                      <motion.button
                        key={customType.id}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.04 + index * 0.05,
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1]
                        }}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={
                          closedInstance
                            ? () => {
                                void reopenCustomSatellite(closedInstance.id);
                              }
                            : undefined
                        }
                        onPointerDown={
                          closedInstance
                            ? undefined
                            : (e) => startCustomDrag(e, customType)
                        }
                        className={`group flex w-full touch-none select-none items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-[color:var(--accent-soft)] ${
                          closedInstance
                            ? "cursor-pointer"
                            : "cursor-grab active:cursor-grabbing"
                        }`}
                      >
                        <span
                          className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--line)]"
                          style={{
                            background: palette.soft,
                            color: palette.accent
                          }}
                        >
                          <CustomSatelliteIcon icon={customType.icon} />
                        </span>
                        <span className="flex min-w-0 flex-col text-left leading-tight">
                          <span className="font-display truncate text-[14px] font-semibold">
                            {customType.name}
                          </span>
                          <span className="text-[11.5px] text-[color:var(--faint)] font-mono">
                            {closedInstance
                              ? "cerrado · reabrir"
                              : `${customType.properties.length} campos`}
                          </span>
                        </span>
                        <span className="ml-auto font-mono text-[10.5px] text-[color:var(--faint)] opacity-0 transition group-hover:opacity-100">
                          {closedInstance ? "abrir →" : "drag →"}
                        </span>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="shrink-0 mt-1 border-t border-[color:var(--line)] px-2 pt-2 pb-1.5">
              <button
                className="hub-create-satellite"
                onClick={() => {
                  setHub(false);
                  setCreatorOpen(true);
                }}
                type="button"
              >
                <Plus size={13} />
                Crear Satellite
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {drag && typeof document !== "undefined"
        ? createPortal(<DragGhost drag={drag} />, document.body)
        : null}

      <SatelliteCreator
        onClose={() => setCreatorOpen(false)}
        open={creatorOpen}
      />
    </div>
  );
}

function DragGhost({ drag }: { drag: DragState }) {
  const isCustom = drag.source === "custom";
  const title = isCustom ? drag.customType.name : drag.meta.title;
  const icon = isCustom ? (
    <CustomSatelliteIcon icon={drag.customType.icon} size={13} />
  ) : (
    drag.meta.icon
  );

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
        pointerEvents: "none"
      }}
      className="satellite-shell flex items-center gap-2 rounded-[14px] px-2.5 py-1.5"
    >
      <span className="sat-icon-btn" data-active="true">
        {icon}
      </span>
      <span className="sat-title pr-1">{title}</span>
    </motion.div>
  );
}

/** Back-compat: allow existing imports of <SatelliteHub /> to still work. */
export function SatelliteHub() {
  return null;
}
