import type { PomodoroTimer } from "./pomodoro-timer";
import { isPomodoroActive } from "./pomodoro-timer";
import { isReminderNearFuture } from "./reminder-utils";
import type { Reminder, Satellite, SatelliteKind } from "./types";

export const CALENDAR_INDICATOR_WINDOW_MS = 30 * 60_000;

export function isSatelliteActive(
  kind: SatelliteKind,
  pomodoroTimer: PomodoroTimer,
  reminders: Reminder[],
  now: number
): boolean {
  if (kind === "pomodoro") return isPomodoroActive(pomodoroTimer);
  if (kind === "calendar") {
    return reminders.some((reminder) =>
      isReminderNearFuture(reminder, now, CALENDAR_INDICATOR_WINDOW_MS)
    );
  }
  return false;
}

export function isSatelliteGhosted(
  kind: SatelliteKind,
  satellites: Satellite[]
): boolean {
  if (kind === "pomodoro" || kind === "calendar") {
    return satellites.some((satellite) => satellite.kind === kind);
  }
  return false;
}
