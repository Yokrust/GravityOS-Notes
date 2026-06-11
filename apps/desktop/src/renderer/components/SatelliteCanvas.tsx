"use client";

import { useEffect, useRef } from "react";
import type { Satellite } from "@/lib/types";
import { useStore } from "@/lib/store";
import { canvasRef, CanvasRefContext } from "@/lib/canvas-ref";
import { QuickNoteSatellite } from "./satellites/QuickNote";
import { CalendarSatellite } from "./satellites/Calendar";
import { PomodoroSatellite } from "./satellites/Pomodoro";
import { CustomSatellite } from "./satellites/CustomSatellite";

function SatelliteFrame({ sat }: { sat: Satellite }) {
  if (sat.kind === "quick-note") return <QuickNoteSatellite sat={sat} />;
  if (sat.kind === "calendar") return <CalendarSatellite sat={sat} />;
  if (sat.kind === "pomodoro") return <PomodoroSatellite sat={sat} />;
  if (sat.kind === "custom") return <CustomSatellite sat={sat} />;
  return null;
}

export function SatelliteCanvas() {
  const { satellites } = useStore();
  const localRef = useRef<HTMLDivElement | null>(null);

  // Publish the canvas DOM element to the shared module-level ref so the
  // hub button (rendered far away in the TopBar) can compute drop coords
  // relative to the editor area.
  useEffect(() => {
    canvasRef.current = localRef.current;
    return () => {
      canvasRef.current = null;
    };
  }, []);

  return (
    <CanvasRefContext.Provider value={localRef}>
      <div ref={localRef} className="absolute inset-0 z-20 pointer-events-none">
        {satellites.map((s) => (
          <SatelliteFrame key={s.id} sat={s} />
        ))}
      </div>
    </CanvasRefContext.Provider>
  );
}
