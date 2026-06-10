import { describe, expect, it } from "vitest";

import {
  loadSatelliteData,
  saveSatelliteData,
  type SatelliteStorage
} from "../../src/renderer/lib/satellite-persistence.js";

class MockStorage implements SatelliteStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("satellite persistence", () => {
  it("returns null when storage is empty", () => {
    expect(loadSatelliteData(new MockStorage())).toBeNull();
  });

  it("roundtrips notes, reminders and pomodoro counters", () => {
    const storage = new MockStorage();
    const now = Date.now();
    const data = {
      quickNotes: [
        { id: "qn-1", title: "My Note", content: "Hello world", updatedAt: now }
      ],
      reminders: [
        {
          id: "r-1",
          seriesId: "r-1",
          date: "2026-05-03",
          time: "10:00",
          text: "Meeting at 10",
          recurrence: "one" as const,
          createdAt: now
        }
      ],
      pomodoroCycles: 5,
      pomodoroBreaks: 3
    };

    saveSatelliteData(data, storage);
    expect(loadSatelliteData(storage)).toEqual(data);
  });

  it("defaults missing legacy counters to zero", () => {
    const storage = new MockStorage();
    storage.setItem(
      "gravity:satellites:v1",
      JSON.stringify({ quickNotes: [], reminders: [], pomodoroCycles: 2 })
    );
    expect(loadSatelliteData(storage)?.pomodoroBreaks).toBe(0);
  });
});
