"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import type { Satellite } from "@/lib/types";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

function isoDate(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function CalendarSatellite({ sat }: { sat: Satellite }) {
  const { reminders, addReminder, deleteReminder } = useStore();

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState(today.getDate());
  const [draftReminder, setDraftReminder] = useState("");
  const [composing, setComposing] = useState(false);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const isCurrentMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();

  const selectedIso = isoDate(
    cursor.getFullYear(),
    cursor.getMonth(),
    selected,
  );
  const selectedReminders = useMemo(
    () => reminders.filter((r) => r.date === selectedIso),
    [reminders, selectedIso],
  );

  // Build a set of dates with reminders for quick lookup of dot indicators.
  const remindedDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of reminders) set.add(r.date);
    return set;
  }, [reminders]);

  const submitReminder = () => {
    const text = draftReminder.trim();
    if (!text) return;
    addReminder(selectedIso, text);
    setDraftReminder("");
    setComposing(false);
  };

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <SatelliteShell
      sat={sat}
      title={monthLabel}
      leftSlot={
        <button
          className="sat-icon-btn"
          data-active="true"
          title="Calendario"
        >
          <CalendarDays size={13} strokeWidth={1.6} />
        </button>
      }
      footerSlot={
        <>
          <span className="uppercase tracking-[0.18em]">
            {selectedReminders.length}{" "}
            {selectedReminders.length === 1 ? "recordatorio" : "recordatorios"}
          </span>
          <button
            onClick={() =>
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
            }
            className="uppercase tracking-[0.18em] hover:text-[var(--sat-ink)] transition"
          >
            Hoy
          </button>
        </>
      }
    >
      <div className="flex flex-col h-full">
        {/* Month nav */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
              )
            }
            className="sat-icon-btn"
          >
            <ChevronLeft size={13} strokeWidth={1.6} />
          </button>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--sat-faint)] font-mono">
              {cursor.getFullYear()}
            </span>
            <span className="text-[14px] font-medium tracking-tight text-[var(--sat-ink)]">
              {MONTHS[cursor.getMonth()]}
            </span>
          </div>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
              )
            }
            className="sat-icon-btn"
          >
            <ChevronRight size={13} strokeWidth={1.6} />
          </button>
        </div>

        {/* DOW header */}
        <div className="grid grid-cols-7 gap-y-0.5 px-2 mt-1 text-center text-[9.5px] uppercase tracking-[0.18em] text-[var(--sat-faint)] font-mono">
          {DOW.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-y-0.5 px-2 pt-1 text-[12px]">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const iso = isoDate(cursor.getFullYear(), cursor.getMonth(), d);
            const isToday = isCurrentMonth && d === today.getDate();
            const isSel = isCurrentMonth && d === selected;
            const hasReminder = remindedDates.has(iso);
            return (
              <div
                key={i}
                className="relative flex items-center justify-center"
              >
                {isSel && (
                  <motion.span
                    layoutId={`cal-pill-${sat.id}`}
                    className="absolute inset-1 rounded-full bg-[var(--sat-ink)]"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
                <button
                  onClick={() => setSelected(d)}
                  className={`relative h-7 w-7 rounded-full transition ${
                    isSel
                      ? "text-[var(--sat-bg)] font-semibold"
                      : isToday
                        ? "text-[var(--sat-ink)] font-semibold"
                        : "text-[var(--sat-muted)] hover:text-[var(--sat-ink)]"
                  }`}
                >
                  {d}
                </button>
                {hasReminder && !isSel && (
                  <span className="absolute bottom-0 h-[3px] w-[3px] rounded-full bg-[var(--sat-ink)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Reminders panel */}
        <div className="sat-divider mt-2" />
        <div className="px-3 pt-2 pb-2 flex flex-col gap-1.5 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--sat-faint)] font-mono">
              {`${MONTHS[cursor.getMonth()].slice(0, 3)} ${selected}`}
            </span>
            <button
              onClick={() => setComposing((v) => !v)}
              className="sat-icon-btn"
              title="Añadir recordatorio"
              data-active={composing ? "true" : "false"}
            >
              <Plus size={12} strokeWidth={1.7} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {composing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--sat-line-strong)] bg-black/30 px-2 py-1">
                  <Bell
                    size={11}
                    strokeWidth={1.6}
                    className="text-[var(--sat-faint)]"
                  />
                  <input
                    autoFocus
                    value={draftReminder}
                    onChange={(e) => setDraftReminder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitReminder();
                      else if (e.key === "Escape") {
                        setComposing(false);
                        setDraftReminder("");
                      }
                    }}
                    placeholder="Recordatorio…"
                    className="flex-1 bg-transparent outline-none text-[12px] text-[var(--sat-ink)]"
                  />
                  <button
                    onClick={submitReminder}
                    className="text-[10px] uppercase tracking-[0.16em] text-[var(--sat-muted)] hover:text-[var(--sat-ink)] transition font-mono"
                  >
                    add
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ul className="flex flex-col gap-0.5 overflow-y-auto scroll-thin">
            {selectedReminders.length === 0 && !composing && (
              <li className="text-[11.5px] text-[var(--sat-faint)] font-mono italic">
                Sin recordatorios para este día.
              </li>
            )}
            {selectedReminders.map((r) => (
              <li
                key={r.id}
                className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/4"
              >
                <span className="h-1 w-1 rounded-full bg-[var(--sat-ink)] shrink-0" />
                <span className="flex-1 text-[12.5px] text-[var(--sat-ink)] truncate">
                  {r.text}
                </span>
                <button
                  onClick={() => deleteReminder(r.id)}
                  className="sat-icon-btn opacity-0 group-hover:opacity-100"
                  title="Eliminar"
                >
                  <X size={11} strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SatelliteShell>
  );
}
