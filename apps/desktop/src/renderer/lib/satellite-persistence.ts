import type { QuickNote, Reminder, ReminderRecurrence } from "./types";

export interface SatelliteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PersistedSatelliteData {
  quickNotes: QuickNote[];
  reminders: Reminder[];
  pomodoroCycles: number;
  pomodoroBreaks: number;
}

const KEY = "gravity:satellites:v1";

type LegacyReminder = Partial<Reminder> &
  Pick<Reminder, "id" | "date" | "text" | "createdAt">;

function normalizeReminder(raw: LegacyReminder): Reminder {
  return {
    id: raw.id,
    seriesId: raw.seriesId ?? raw.id,
    date: raw.date,
    time: raw.time ?? "09:00",
    text: raw.text,
    recurrence: (raw.recurrence as ReminderRecurrence) ?? "one",
    createdAt: raw.createdAt
  };
}

export function loadSatelliteData(
  storage: SatelliteStorage
): PersistedSatelliteData | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSatelliteData>;
    return {
      quickNotes: parsed.quickNotes ?? [],
      reminders: (parsed.reminders ?? []).map(normalizeReminder),
      pomodoroCycles: parsed.pomodoroCycles ?? 0,
      pomodoroBreaks: parsed.pomodoroBreaks ?? 0
    };
  } catch {
    return null;
  }
}

export function saveSatelliteData(
  data: PersistedSatelliteData,
  storage: SatelliteStorage
): void {
  try {
    storage.setItem(
      KEY,
      JSON.stringify({
        quickNotes: data.quickNotes,
        reminders: data.reminders,
        pomodoroCycles: data.pomodoroCycles,
        pomodoroBreaks: data.pomodoroBreaks
      })
    );
  } catch {
    // storage unavailable
  }
}
