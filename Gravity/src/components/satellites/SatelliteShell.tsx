"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { X } from "lucide-react";
import type { Satellite } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useCanvasRef } from "@/lib/canvas-ref";

/**
 * Shared dark-monochrome shell for every satellite.
 *
 *  - leftSlot:    icon-buttons in the top-left (kind-specific)
 *  - title:       short label, centered
 *  - children:    body content
 *  - footerSlot:  optional bottom-rail content
 *
 * The toolbar IS the drag handle. We drive position via framer-motion
 * motion values (x, y) instead of mixing CSS `left/top` with `drag` —
 * that way the drag transform IS the position, dragConstraints clamps
 * fluidly while the user drags, and there is no residual transform on
 * release.
 */
export function SatelliteShell({
  sat,
  title,
  leftSlot,
  footerSlot,
  children,
}: {
  sat: Satellite;
  title: string;
  leftSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { closeSatellite, moveSatellite, focusSatellite } = useStore();
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement | null>(null);
  const canvas = useCanvasRef();

  // Motion values that ARE the satellite's position. Keep them seeded
  // from the store, and re-sync if the store's coords change due to
  // resize-clamping or programmatic moves.
  const x = useMotionValue(sat.x);
  const y = useMotionValue(sat.y);
  useEffect(() => {
    x.set(sat.x);
    y.set(sat.y);
  }, [sat.x, sat.y, x, y]);

  return (
    <motion.div
      ref={ref}
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={canvas ?? undefined}
      dragElastic={0.04}
      // Calmer, faster placement than a bouncy spring — feels like setting
      // an object down on a whiteboard rather than dropping it.
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        x,
        y,
        width: sat.width,
        height: sat.height,
        zIndex: sat.z,
        // top: 0 / left: 0 baseline so that x/y act as absolute coords
        top: 0,
        left: 0,
      }}
      onDragEnd={() => {
        // x and y are already clamped by dragConstraints — just persist.
        moveSatellite(sat.id, x.get(), y.get());
      }}
      onPointerDown={() => focusSatellite(sat.id)}
      className="satellite-shell rounded-[18px] flex flex-col overflow-hidden pointer-events-auto will-change-transform"
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="sat-toolbar relative flex items-center h-9 px-2 gap-1 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-0.5 z-[1]">{leftSlot}</div>
        <div className="sat-title absolute left-1/2 -translate-x-1/2 truncate max-w-[60%] pointer-events-none">
          {title}
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => closeSatellite(sat.id)}
          className="sat-icon-btn ml-auto z-[1]"
          title="Cerrar"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      {footerSlot && (
        <div className="relative border-t border-[var(--sat-line)] px-3 py-1.5 text-[10.5px] font-mono text-[var(--sat-muted)] flex items-center justify-between">
          {footerSlot}
        </div>
      )}
    </motion.div>
  );
}
