"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import { reminderMatchesDate } from "@/lib/reminder-utils";
import type { BuiltInSatellite, ReminderRecurrence } from "@/lib/types";

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
  "Diciembre"
];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

const RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  one: "Una vez",
  daily: "Diario",
  weekly: "Semanal"
};

const RECURRENCE_BADGE: Record<ReminderRecurrence, string | null> = {
  one: null,
  daily: "diario",
  weekly: "semanal"
};

function isoDate(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function CalendarSatellite({ sat }: { sat: BuiltInSatellite }) {
  const { reminders, addReminder, deleteReminder } = useStore();

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState(today.getDate());
  const [draftReminder, setDraftReminder] = useState("");
  const [draftTime, setDraftTime] = useState("09:00");
  const [draftRecurrence, setDraftRecurrence] =
    useState<ReminderRecurrence>("one");
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
    selected
  );

  const selectedReminders = useMemo(
    () => reminders.filter((r) => reminderMatchesDate(r, selectedIso)),
    [reminders, selectedIso]
  );

  const remindedDates = useMemo(() => {
    const set = new Set<string>();
    for (const cell of cells) {
      if (cell === null) continue;
      const iso = isoDate(cursor.getFullYear(), cursor.getMonth(), cell);
      for (const reminder of reminders) {
        if (reminderMatchesDate(reminder, iso)) {
          set.add(iso);
          break;
        }
      }
    }
    return set;
  }, [reminders, cursor, cells]);

  const submitReminder = () => {
    const text = draftReminder.trim();
    if (!text) return;
    addReminder(selectedIso, draftTime, text, draftRecurrence);
    setDraftReminder("");
    setDraftTime("09:00");
    setDraftRecurrence("one");
    setComposing(false);
  };

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <SatelliteShell
      sat={sat}
      title={monthLabel}
      leftSlot={
        <button className="sat-icon-btn" data-active="true" title="Calendario">
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
            className="uppercase tracking-[0.18em] hover:text-[color:var(--sat-ink)] transition"
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
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
              )
            }
            className="sat-icon-btn"
          >
            <ChevronLeft size={13} strokeWidth={1.6} />
          </button>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[9.5px] uppercase tracking-[0.22em] text-[color:var(--sat-faint)] font-mono">
              {cursor.getFullYear()}
            </span>
            <span className="text-[14px] font-medium tracking-tight text-[color:var(--sat-ink)]">
              {MONTHS[cursor.getMonth()]}
            </span>
          </div>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
              )
            }
            className="sat-icon-btn"
          >
            <ChevronRight size={13} strokeWidth={1.6} />
          </button>
        </div>

        {/* DOW header */}
        <div className="grid grid-cols-7 gap-y-0.5 px-2 mt-1 text-center text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--sat-faint)] font-mono">
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
                    className="absolute inset-1 rounded-full bg-[var(--sat-accent)]"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
                <button
                  onClick={() => setSelected(d)}
                  className={`relative h-7 w-7 rounded-full transition ${
                    isSel
                      ? "text-[color:var(--sat-accent-ink)] font-semibold"
                      : isToday
                        ? "text-[color:var(--sat-accent)] font-semibold"
                        : "text-[color:var(--sat-muted)] hover:text-[color:var(--sat-ink)]"
                  }`}
                >
                  {d}
                </button>
                {hasReminder && !isSel && (
                  <span className="absolute bottom-0 h-[3px] w-[3px] rounded-full bg-[var(--sat-accent)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Reminders panel */}
        <div className="sat-divider mt-2" />
        <div className="px-3 pt-2 pb-2 flex flex-col gap-1.5 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--sat-faint)] font-mono">
              {`${MONTHS[cursor.getMonth()]!.slice(0, 3)} ${selected}`}
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
                <div className="sat-inset flex flex-col gap-1 rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Bell
                      size={11}
                      strokeWidth={1.6}
                      className="text-[color:var(--sat-faint)]"
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
                      className="flex-1 bg-transparent outline-none text-[12px] text-[color:var(--sat-ink)]"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-[19px]">
                    <input
                      type="time"
                      value={draftTime}
                      onChange={(e) => setDraftTime(e.target.value)}
                      className="w-[68px] bg-transparent font-mono text-[11px] text-[color:var(--sat-muted)] outline-none"
                    />
                    <select
                      value={draftRecurrence}
                      onChange={(e) =>
                        setDraftRecurrence(e.target.value as ReminderRecurrence)
                      }
                      className="flex-1 bg-transparent font-mono text-[11px] text-[color:var(--sat-muted)] outline-none"
                    >
                      {(
                        Object.keys(RECURRENCE_LABELS) as ReminderRecurrence[]
                      ).map((key) => (
                        <option key={key} value={key}>
                          {RECURRENCE_LABELS[key]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={submitReminder}
                      className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--sat-muted)] transition hover:text-[color:var(--sat-ink)]"
                    >
                      add
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ul className="flex flex-col gap-0.5 overflow-y-auto scroll-thin">
            {selectedReminders.length === 0 && !composing && (
              <li className="text-[11.5px] text-[color:var(--sat-faint)] font-mono italic">
                Sin recordatorios para este día.
              </li>
            )}
            {selectedReminders.map((r) => {
              const badge = RECURRENCE_BADGE[r.recurrence];
              return (
                <li
                  key={r.id}
                  className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--sat-hover)]"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--sat-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-[color:var(--sat-ink)]">
                      {r.text}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-[color:var(--sat-faint)]">
                      {r.time}
                      {badge ? (
                        <>
                          <span className="opacity-40">·</span>
                          <RefreshCw size={8} strokeWidth={2} />
                          {badge}
                        </>
                      ) : null}
                    </span>
                  </span>
                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="sat-icon-btn opacity-0 group-hover:opacity-100"
                    title={badge ? "Eliminar serie completa" : "Eliminar"}
                  >
                    <X size={11} strokeWidth={1.6} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </SatelliteShell>
  );
}
