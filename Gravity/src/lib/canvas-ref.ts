import { createContext, useContext, type RefObject } from "react";

// Shared imperative handle to the satellite canvas element so non-child
// components (e.g. the hub button in the TopBar) can compute drop
// coordinates relative to the editor canvas bounds instead of the viewport.
export const canvasRef: { current: HTMLDivElement | null } = {
  current: null,
};

// React context that exposes the same DOM node as a real ref object so
// children (satellite shells) can pass it to framer-motion's
// `dragConstraints` for fluid, edge-aware dragging.
export const CanvasRefContext = createContext<RefObject<HTMLDivElement | null> | null>(
  null,
);

export function useCanvasRef(): RefObject<HTMLDivElement | null> | null {
  return useContext(CanvasRefContext);
}
