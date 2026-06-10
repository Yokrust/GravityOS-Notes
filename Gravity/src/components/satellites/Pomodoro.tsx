"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { SatelliteShell } from "./SatelliteShell";
import type { Satellite } from "@/lib/types";

type Mode = "focus" | "break";

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
};

export function PomodoroSatellite({ sat }: { sat: Satellite }) {
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          setCompleted((c) => (mode === "focus" ? c + 1 : c));
          const next: Mode = mode === "focus" ? "break" : "focus";
          setMode(next);
          return DURATIONS[next];
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running, mode]);

  const total = DURATIONS[mode];
  const progress = 1 - remaining / total;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  const totalLabel =
    mode === "focus" ? "Foco · 25:00" : "Descanso · 05:00";

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
          <span className="uppercase tracking-[0.18em]">
            {completed} ciclos
          </span>
          <span className="uppercase tracking-[0.18em] opacity-60">
            {mode === "focus" ? "Concéntrate" : "Respira"}
          </span>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-3 pb-4 gap-4">
        {/* Mode switch */}
        <div className="inline-flex items-center rounded-full p-0.5 text-[11px] border border-[var(--sat-line-strong)] bg-black/30">
          {(["focus", "break"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setRemaining(DURATIONS[m]);
                setRunning(false);
              }}
              className={`relative px-3 py-1 rounded-full transition font-mono uppercase tracking-[0.14em] ${
                mode === m
                  ? "text-[var(--sat-bg)]"
                  : "text-[var(--sat-muted)] hover:text-[var(--sat-ink)]"
              }`}
            >
              {mode === m && (
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
              {mode === "focus" ? "Foco" : "Descanso"}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setRunning((r) => !r)}
            className="grid place-items-center h-9 w-9 rounded-full bg-[var(--sat-ink)] text-[var(--sat-bg)]"
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setRemaining(DURATIONS[mode]);
              setRunning(false);
            }}
            className="grid place-items-center h-9 w-9 rounded-full border border-[var(--sat-line-strong)] text-[var(--sat-muted)] hover:text-[var(--sat-ink)] transition"
          >
            <RotateCcw size={13} />
          </motion.button>
        </div>
      </div>
    </SatelliteShell>
  );
}
