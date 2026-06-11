"use client";

import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import { POMODORO_DURATIONS } from "@/lib/pomodoro-timer";
import type { BuiltInSatellite } from "@/lib/types";

export function PomodoroSatellite({ sat }: { sat: BuiltInSatellite }) {
  const {
    pomodoroTimer,
    pomodoroStart,
    pomodoroPause,
    pomodoroReset,
    pomodoroSetMode
  } = useStore();

  const { mode, remaining, status, cycles, breaks } = pomodoroTimer;
  const total = POMODORO_DURATIONS[mode];
  const progress = 1 - remaining / total;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  const totalLabel =
    mode === "focus"
      ? "Foco · 25:00"
      : mode === "short-break"
        ? "Descanso · 05:00"
        : "Descanso largo · 15:00";

  const running = status === "running";
  const isBreak = mode !== "focus";

  return (
    <SatelliteShell
      sat={sat}
      title={totalLabel}
      leftSlot={
        <button className="sat-icon-btn" data-active="true" title="Pomodoro">
          <Timer size={13} strokeWidth={1.6} />
        </button>
      }
      footerSlot={
        <>
          <span className="uppercase tracking-[0.18em]">{cycles} ciclos</span>
          <span className="uppercase tracking-[0.18em] opacity-60">
            {breaks} descansos
          </span>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-3 pb-4 gap-4">
        {/* Mode switch */}
        <div className="inline-flex items-center rounded-full p-0.5 text-[11px] border border-[var(--sat-line-strong)] bg-black/30">
          {(["focus", "short-break"] as const).map((m) => (
            <button
              key={m}
              onClick={() => pomodoroSetMode(m)}
              className={`relative px-3 py-1 rounded-full transition font-mono uppercase tracking-[0.14em] ${
                (m === "focus" && mode === "focus") ||
                (m === "short-break" && isBreak)
                  ? "text-[var(--sat-bg)]"
                  : "text-[var(--sat-muted)] hover:text-[var(--sat-ink)]"
              }`}
            >
              {((m === "focus" && mode === "focus") ||
                (m === "short-break" && isBreak)) && (
                <motion.span
                  layoutId={`pomo-pill-${sat.id}`}
                  className="absolute inset-0 bg-[var(--sat-ink)] rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative">
                {m === "focus" ? "Foco" : "Descanso"}
              </span>
            </button>
          ))}
        </div>

        {/* Ring + time */}
        <div className="relative">
          <svg width={170} height={170} className="-rotate-90">
            <circle
              cx={85}
              cy={85}
              r={radius}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={4}
              fill="none"
            />
            <motion.circle
              cx={85}
              cy={85}
              r={radius}
              stroke="rgba(241,239,232,0.92)"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: circumference * (1 - progress) }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-[34px] font-semibold tracking-[-0.01em] tabular-nums text-[var(--sat-ink)]">
              {minutes}:{seconds}
            </div>
            <div className="text-[9.5px] uppercase tracking-[0.22em] text-[var(--sat-faint)] mt-1">
              {mode === "focus"
                ? "Foco"
                : mode === "short-break"
                  ? "Descanso"
                  : "Descanso largo"}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={running ? pomodoroPause : pomodoroStart}
            className="grid place-items-center h-9 w-9 rounded-full bg-[var(--sat-ink)] text-[var(--sat-bg)]"
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={pomodoroReset}
            className="grid place-items-center h-9 w-9 rounded-full border border-[var(--sat-line-strong)] text-[var(--sat-muted)] hover:text-[var(--sat-ink)] transition"
          >
            <RotateCcw size={13} />
          </motion.button>
        </div>
      </div>
    </SatelliteShell>
  );
}
