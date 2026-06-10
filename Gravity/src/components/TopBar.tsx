"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FilePlus,
  FolderPlus,
  PanelLeft,
  Search,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { GravityLogo } from "./Logo";
import { SatelliteHubButton } from "./SatelliteHub";

export function TopBar() {
  const {
    setPalette,
    addNote,
    addFolder,
    sidebarOpen,
    toggleSidebar,
    hubOpen,
  } = useStore();

  return (
    <div className="relative z-30 flex items-center h-12 px-4 border-b border-[color:var(--line)] bg-[color:var(--bg-paper)]/60 backdrop-blur-xl">
      {/* Left — brand + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          onClick={toggleSidebar}
          whileTap={{ scale: 0.94 }}
          className="group flex items-center gap-2"
          title={sidebarOpen ? "Ocultar panel" : "Mostrar panel"}
        >
          <span className="relative grid place-items-center h-6 w-6 rounded-[7px] bg-[color:var(--ink)] text-[color:var(--bg-paper)] overflow-hidden">
            <motion.span
              animate={{ rotate: sidebarOpen ? 0 : 180 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
            >
              <GravityLogo size={14} />
            </motion.span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight leading-none">
            Gravity
          </span>
        </motion.button>

        <span className="h-4 w-px bg-[color:var(--line)] mx-1" />

        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] transition"
          title="Panel lateral"
        >
          <PanelLeft size={14} />
        </button>

      </div>

      {/* Center — command trigger */}
      <div className="flex-1 flex justify-center px-6">
        <motion.button
          whileTap={{ scale: 0.985 }}
          whileHover={{ y: -0.5 }}
          onClick={() => setPalette(true)}
          className="group relative flex items-center gap-3 w-full max-w-[560px] h-8 rounded-full border border-[color:var(--line)] hover:border-[color:var(--line-strong)] bg-white/50 dark:bg-white/5 px-3 transition"
        >
          <Search
            size={13}
            className="text-[color:var(--muted)] group-hover:text-[color:var(--ink)] transition"
          />
          <span className="text-[12.5px] text-[color:var(--muted)] font-normal">
            Buscar nota · ejecutar comando · crear satélite
          </span>
          <span className="ml-auto inline-flex items-center gap-0.5">
            <kbd className="rounded bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--muted)]">
              ⌘
            </kbd>
            <kbd className="rounded bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[color:var(--muted)]">
              K
            </kbd>
          </span>
        </motion.button>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">
        <TopAction onClick={() => addNote()} icon={<FilePlus size={13} />}>
          Nota
        </TopAction>
        <TopAction
          onClick={() => addFolder()}
          icon={<FolderPlus size={13} />}
        >
          Carpeta
        </TopAction>
        <span className="h-4 w-px bg-[color:var(--line)] mx-1" />
        <SatelliteHubButton />
        <AnimatePresence>
          {hubOpen && (
            <motion.span
              key="hub-active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-full h-px bg-[color:var(--ink)]"
              style={{ transformOrigin: "right" }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TopAction({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -0.5 }}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] transition"
    >
      {icon}
      <span>{children}</span>
    </motion.button>
  );
}

export function MobileClose() {
  return <X />;
}
