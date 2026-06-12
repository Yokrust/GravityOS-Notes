export type {
  PomodoroMode,
  PomodoroStatus,
  PomodoroTimer
} from "./pomodoro-timer";

export type NoteId = string;

export interface FileNode {
  id: NoteId;
  name: string;
  path: string;
  type: "folder" | "note";
  children?: FileNode[];
  /** Raw markdown-ish content (only for notes) */
  content?: string;
  /** Last edited timestamp */
  updatedAt?: number;
}

export type BuiltInSatelliteKind = "quick-note" | "calendar" | "pomodoro";
export type SatelliteKind = BuiltInSatelliteKind | "custom";

interface SatelliteFrame {
  id: string;
  /** Position of satellite on canvas */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stack order */
  z: number;
}

export interface BuiltInSatellite extends SatelliteFrame {
  kind: BuiltInSatelliteKind;
  /** Per-satellite metadata (e.g. which quick-note is being edited) */
  meta?: SatelliteMeta;
}

/** Instancia persistida de un Satellite custom, proyectada al lienzo. */
export interface CustomSatellite extends SatelliteFrame {
  kind: "custom";
  customTypeId: string;
  data: Record<string, SatelliteValueRecord>;
  createdAt: string;
  updatedAt: string;
}

export type Satellite = BuiltInSatellite | CustomSatellite;

export interface SatelliteMeta {
  activeQuickNoteId?: string;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export type ReminderRecurrence = "one" | "daily" | "weekly";

export interface Reminder {
  id: string;
  /** Groups all occurrences of a recurring series; equals id for one-off reminders */
  seriesId: string;
  /** ISO start date (YYYY-MM-DD); for recurring reminders this is the first occurrence */
  date: string;
  /** HH:MM local time */
  time: string;
  text: string;
  recurrence: ReminderRecurrence;
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
