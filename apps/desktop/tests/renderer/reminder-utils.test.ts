import { describe, expect, it } from "vitest";

import {
  isReminderNearFuture,
  nextOccurrenceAfter,
  reminderFiresNow,
  reminderMatchesDate
} from "../../src/renderer/lib/reminder-utils.js";
import type { Reminder } from "../../src/renderer/lib/types.js";

const base: Reminder = {
  id: "r-1",
  seriesId: "r-1",
  date: "2026-05-03",
  time: "09:00",
  text: "Test reminder",
  recurrence: "one",
  createdAt: 0
};

function localMs(iso: string, hours: number, minutes: number): number {
  const date = new Date(`${iso}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

describe("reminderMatchesDate", () => {
  it("matches one-off reminders on the exact date", () => {
    expect(reminderMatchesDate(base, "2026-05-03")).toBe(true);
    expect(reminderMatchesDate(base, "2026-05-04")).toBe(false);
  });

  it("matches daily reminders after the start date", () => {
    expect(
      reminderMatchesDate({ ...base, recurrence: "daily" }, "2026-05-10")
    ).toBe(true);
  });

  it("matches weekly reminders every 7 days", () => {
    expect(
      reminderMatchesDate({ ...base, recurrence: "weekly" }, "2026-05-10")
    ).toBe(true);
    expect(
      reminderMatchesDate({ ...base, recurrence: "weekly" }, "2026-05-11")
    ).toBe(false);
  });
});

describe("reminderFiresNow", () => {
  it("fires during the scheduled minute", () => {
    expect(reminderFiresNow(base, localMs("2026-05-03", 9, 0))).toBe(true);
    expect(reminderFiresNow(base, localMs("2026-05-03", 9, 0) + 30_000)).toBe(
      true
    );
    expect(reminderFiresNow(base, localMs("2026-05-03", 9, 1))).toBe(false);
  });
});

describe("isReminderNearFuture", () => {
  it("returns true when reminder is within the window", () => {
    expect(
      isReminderNearFuture(base, localMs("2026-05-03", 8, 45), 30 * 60_000)
    ).toBe(true);
  });
});

describe("nextOccurrenceAfter", () => {
  it("returns the next daily occurrence", () => {
    expect(
      nextOccurrenceAfter(
        { ...base, recurrence: "daily" },
        localMs("2026-05-03", 9, 30)
      )
    ).toBe(localMs("2026-05-04", 9, 0));
  });
});
