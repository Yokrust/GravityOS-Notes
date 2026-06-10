import type { Reminder } from "./types";

function isoFromMs(milliseconds: number): string {
  const date = new Date(milliseconds);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fireTimeMs(reminder: Reminder, iso: string): number {
  const [hours = 0, minutes = 0] = reminder.time.split(":").map(Number);
  const date = new Date(`${iso}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function daysBetween(isoA: string, isoB: string): number {
  const left = Date.parse(`${isoA}T00:00:00Z`);
  const right = Date.parse(`${isoB}T00:00:00Z`);
  return Math.round((right - left) / 86_400_000);
}

export function reminderMatchesDate(reminder: Reminder, iso: string): boolean {
  if (iso < reminder.date) return false;
  if (reminder.recurrence === "one") return reminder.date === iso;
  const diff = daysBetween(reminder.date, iso);
  if (reminder.recurrence === "daily") return diff >= 0;
  if (reminder.recurrence === "weekly") return diff >= 0 && diff % 7 === 0;
  return false;
}

export function reminderFiresNow(
  reminder: Reminder,
  nowMilliseconds: number
): boolean {
  const iso = isoFromMs(nowMilliseconds);
  if (!reminderMatchesDate(reminder, iso)) return false;
  const fire = fireTimeMs(reminder, iso);
  const diff = nowMilliseconds - fire;
  return diff >= 0 && diff < 60_000;
}

export function isReminderNearFuture(
  reminder: Reminder,
  nowMilliseconds: number,
  windowMilliseconds: number
): boolean {
  const daysToCheck = Math.ceil(windowMilliseconds / 86_400_000) + 1;
  for (let index = 0; index <= daysToCheck; index += 1) {
    const iso = isoFromMs(nowMilliseconds + index * 86_400_000);
    if (!reminderMatchesDate(reminder, iso)) continue;
    const fire = fireTimeMs(reminder, iso);
    if (
      fire >= nowMilliseconds &&
      fire <= nowMilliseconds + windowMilliseconds
    ) {
      return true;
    }
  }
  return false;
}

export function nextOccurrenceAfter(
  reminder: Reminder,
  afterMilliseconds: number
): number | null {
  if (reminder.recurrence === "one") {
    const fire = fireTimeMs(reminder, reminder.date);
    return fire > afterMilliseconds ? fire : null;
  }
  const maxDays = reminder.recurrence === "weekly" ? 8 : 2;
  for (let index = 0; index <= maxDays; index += 1) {
    const iso = isoFromMs(afterMilliseconds + index * 86_400_000);
    if (!reminderMatchesDate(reminder, iso)) continue;
    const fire = fireTimeMs(reminder, iso);
    if (fire > afterMilliseconds) return fire;
  }
  return null;
}
