"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { NoteEditor } from "./NoteEditor";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { SatelliteCanvas } from "./SatelliteCanvas";

function WorkspaceInner() {
  const { sidebarOpen, paletteOpen, setPalette } = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!paletteOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        // toggleSidebar handled via store
      }
      if (e.key === "Escape" && paletteOpen) setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPalette]);

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col">
      <div className="board-bg" aria-hidden />

      <TopBar />

      <div className="relative flex-1 flex min-h-0">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ x: -20, opacity: 0, width: 0 }}
              animate={{ x: 0, opacity: 1, width: 272 }}
              exit={{ x: -20, opacity: 0, width: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 overflow-hidden border-r border-[color:var(--line)] relative z-10"
            >
              <Sidebar />
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0 relative overflow-hidden">
          <NoteEditor />
          <SatelliteCanvas />
        </main>
      </div>

      <AnimatePresence>
        {paletteOpen && <CommandPalette key="palette" />}
      </AnimatePresence>
    </div>
  );
}

export function Workspace() {
  return (
    <StoreProvider>
      <WorkspaceInner />
    </StoreProvider>
  );
}
