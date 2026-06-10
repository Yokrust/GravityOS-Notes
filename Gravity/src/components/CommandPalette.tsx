"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Command } from "cmdk";
import {
  Calendar,
  CornerDownLeft,
  FilePlus,
  FileText,
  FolderPlus,
  PanelLeft,
  Search,
  Sparkles,
  StickyNote,
  Timer,
} from "lucide-react";
import { useStore, useNoteSearch } from "@/lib/store";

export function CommandPalette() {
  const {
    setPalette,
    selectNote,
    addNote,
    addFolder,
    toggleSidebar,
    spawnSatellite,
  } = useStore();
  const [query, setQuery] = useState("");
  const notes = useNoteSearch(query);

  const close = () => setPalette(false);

  const limited = useMemo(() => notes.slice(0, 6), [notes]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative w-full max-w-[640px] rounded-[var(--radius-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Comandos rápidos" className="flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--line)]">
            <Search size={15} className="text-[color:var(--muted)]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar notas, ejecutar acciones…"
              className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-[color:var(--faint)]"
            />
            <span className="text-[10.5px] text-[color:var(--faint)]">
              ESC para cerrar
            </span>
          </div>

          <Command.List className="max-h-[55vh] overflow-y-auto scroll-thin p-2">
            <Command.Empty className="px-4 py-8 text-center text-[13px] text-[color:var(--muted)]">
              Sin coincidencias
            </Command.Empty>

            {limited.length > 0 && (
              <Command.Group
                heading="Notas"
                className=""
              >
                {limited.map((n) => (
                  <PaletteItem
                    key={n.id}
                    onSelect={() => {
                      selectNote(n.id);
                      close();
                    }}
                    icon={<FileText size={13} />}
                    title={n.name}
                    subtitle={n.content?.slice(0, 60).replace(/\n/g, " ")}
                  />
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Acciones"
              className="mt-2"
            >
              <PaletteItem
                onSelect={() => {
                  addNote();
                  close();
                }}
                icon={<FilePlus size={13} />}
                title="Crear nota"
                shortcut={["⌘", "N"]}
              />
              <PaletteItem
                onSelect={() => {
                  addFolder();
                  close();
                }}
                icon={<FolderPlus size={13} />}
                title="Crear carpeta"
              />
              <PaletteItem
                onSelect={() => {
                  toggleSidebar();
                  close();
                }}
                icon={<PanelLeft size={13} />}
                title="Mostrar/ocultar panel lateral"
                shortcut={["⌘", "\\"]}
              />
            </Command.Group>

            <Command.Group
              heading="Satélites"
              className="mt-2"
            >
              <PaletteItem
                onSelect={() => {
                  spawnSatellite("quick-note");
                  close();
                }}
                icon={<StickyNote size={13} />}
                title="Quick Note"
                subtitle="Una nota efímera flotante"
              />
              <PaletteItem
                onSelect={() => {
                  spawnSatellite("calendar");
                  close();
                }}
                icon={<Calendar size={13} />}
                title="Calendario"
                subtitle="Mini calendario del mes"
              />
              <PaletteItem
                onSelect={() => {
                  spawnSatellite("pomodoro");
                  close();
                }}
                icon={<Timer size={13} />}
                title="Pomodoro"
                subtitle="Temporizador 25 / 5"
              />
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-4 py-2 border-t border-[color:var(--line)] text-[11px] text-[color:var(--faint)]">
            <span className="inline-flex items-center gap-1">
              <Sparkles size={11} /> Comandos rápidos
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft size={11} /> para seleccionar
            </span>
          </div>
        </Command>
      </motion.div>
    </motion.div>
  );
}

function PaletteItem({
  icon,
  title,
  subtitle,
  shortcut,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  shortcut?: string[];
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer aria-selected:bg-[color:var(--accent-soft)] aria-selected:text-[color:var(--ink)] text-[color:var(--muted)] transition"
    >
      <span className="grid place-items-center h-7 w-7 rounded-md bg-white/60 dark:bg-white/10 text-[color:var(--ink)]">
        {icon}
      </span>
      <span className="flex flex-col flex-1 min-w-0">
        <span className="text-[color:var(--ink)] font-medium truncate">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11.5px] text-[color:var(--faint)] truncate">
            {subtitle}
          </span>
        )}
      </span>
      {shortcut && (
        <span className="ml-auto inline-flex items-center gap-0.5">
          {shortcut.map((k) => (
            <kbd
              key={k}
              className="rounded bg-black/5 dark:bg-white/10 px-1 py-0.5 text-[10.5px] font-sans text-[color:var(--muted)]"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
