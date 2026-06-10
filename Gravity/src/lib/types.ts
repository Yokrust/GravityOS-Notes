export type NoteId = string;

export interface FileNode {
  id: NoteId;
  name: string;
  type: "folder" | "note";
  children?: FileNode[];
  /** Raw markdown-ish content (only for notes) */
  content?: string;
  /** Last edited timestamp */
  updatedAt?: number;
}

export type SatelliteKind = "quick-note" | "calendar" | "pomodoro";

export interface Satellite {
  id: string;
  kind: SatelliteKind;
  /** Position of satellite on canvas */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stack order */
  z: number;
  /** Per-satellite metadata (e.g. which quick-note is being edited) */
  meta?: SatelliteMeta;
}

export interface SatelliteMeta {
  activeQuickNoteId?: string;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  text: string;
  createdAt: number;
}

export interface CommandItem {
  id: string;
  title: string;
  hint?: string;
  group: "Navegación" | "Notas" | "Satélites" | "Vista";
  shortcut?: string[];
  perform: () => void;
}
