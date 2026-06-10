import { describe, expect, it } from "vitest";

import {
  CALENDAR_INDICATOR_WINDOW_MS,
  isSatelliteActive,
  isSatelliteGhosted
} from "../../src/renderer/lib/satellite-hub-utils.js";
import { initialPomodoroTimer } from "../../src/renderer/lib/pomodoro-timer.js";
import type { Reminder, Satellite } from "../../src/renderer/lib/types.js";

const noReminders: Reminder[] = [];
const noSatellites: Satellite[] = [];

const makeSatellite = (kind: Satellite["kind"], id = "sat-1"): Satellite => ({
  id,
  kind,
  x: 0,
  y: 0,
  width: 300,
  height: 400,
  z: 10
});

const makeReminder = (offsetMs: number, nowMs: number): Reminder => {
  const fireMs = nowMs + offsetMs;
  const date = new Date(fireMs);
  return {
    id: "r-1",
    seriesId: "r-1",
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    text: "Test reminder",
    recurrence: "one",
    createdAt: nowMs - 1000
  };
};

describe("satellite hub utils", () => {
  const now = Date.now();

  it("marks pomodoro as active when timer is running", () => {
    expect(
      isSatelliteActive(
        "pomodoro",
        { ...initialPomodoroTimer, status: "running" },
        noReminders,
        now
      )
    ).toBe(true);
  });

  it("marks calendar as active when reminder is near", () => {
    expect(
      isSatelliteActive(
        "calendar",
        initialPomodoroTimer,
        [makeReminder(CALENDAR_INDICATOR_WINDOW_MS - 60_000, now)],
        now
      )
    ).toBe(true);
  });

  it("ghosts singleton satellites when already open", () => {
    expect(isSatelliteGhosted("pomodoro", [makeSatellite("pomodoro")])).toBe(
      true
    );
    expect(isSatelliteGhosted("calendar", [makeSatellite("calendar")])).toBe(
      true
    );
    expect(
      isSatelliteGhosted("quick-note", [makeSatellite("quick-note")])
    ).toBe(false);
    expect(isSatelliteGhosted("pomodoro", noSatellites)).toBe(false);
  });
});
