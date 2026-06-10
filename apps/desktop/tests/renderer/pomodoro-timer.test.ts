import { describe, expect, it } from "vitest";

import {
  POMODORO_DURATIONS,
  initialPomodoroTimer,
  isPomodoroActive,
  pomodoroReducer,
  type PomodoroTimer
} from "../../src/renderer/lib/pomodoro-timer.js";

describe("pomodoro timer reducer", () => {
  describe("pomo-start", () => {
    it("transitions from idle to running", () => {
      const next = pomodoroReducer(initialPomodoroTimer, {
        type: "pomo-start"
      });
      expect(next.status).toBe("running");
    });

    it("transitions from paused to running and preserves remaining", () => {
      const paused: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "paused",
        remaining: 1000
      };
      const next = pomodoroReducer(paused, { type: "pomo-start" });
      expect(next.status).toBe("running");
      expect(next.remaining).toBe(1000);
    });

    it("is a no-op when already running", () => {
      const running: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "running"
      };
      const next = pomodoroReducer(running, { type: "pomo-start" });
      expect(next).toBe(running);
    });
  });

  describe("pomo-pause", () => {
    it("transitions from running to paused", () => {
      const running: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "running"
      };
      const next = pomodoroReducer(running, { type: "pomo-pause" });
      expect(next.status).toBe("paused");
    });

    it("is a no-op when idle", () => {
      const next = pomodoroReducer(initialPomodoroTimer, {
        type: "pomo-pause"
      });
      expect(next).toBe(initialPomodoroTimer);
    });

    it("is a no-op when already paused", () => {
      const paused: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "paused"
      };
      const next = pomodoroReducer(paused, { type: "pomo-pause" });
      expect(next).toBe(paused);
    });
  });

  describe("pomo-reset", () => {
    it("resets to focus mode idle with full focus duration", () => {
      const running: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "running",
        remaining: 100
      };
      const next = pomodoroReducer(running, { type: "pomo-reset" });
      expect(next.status).toBe("idle");
      expect(next.mode).toBe("focus");
      expect(next.remaining).toBe(POMODORO_DURATIONS.focus);
    });

    it("resets to focus mode even when currently in short-break", () => {
      const inBreak: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "short-break",
        remaining: 50,
        status: "running"
      };
      const next = pomodoroReducer(inBreak, { type: "pomo-reset" });
      expect(next.status).toBe("idle");
      expect(next.mode).toBe("focus");
      expect(next.remaining).toBe(POMODORO_DURATIONS.focus);
    });

    it("resets to focus mode even when currently in long-break", () => {
      const inLongBreak: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "long-break",
        remaining: 200,
        status: "running"
      };
      const next = pomodoroReducer(inLongBreak, { type: "pomo-reset" });
      expect(next.status).toBe("idle");
      expect(next.mode).toBe("focus");
      expect(next.remaining).toBe(POMODORO_DURATIONS.focus);
    });

    it("preserves the cycles counter", () => {
      const withCycles: PomodoroTimer = {
        ...initialPomodoroTimer,
        cycles: 3,
        status: "running",
        remaining: 100
      };
      const next = pomodoroReducer(withCycles, { type: "pomo-reset" });
      expect(next.cycles).toBe(3);
    });

    it("preserves the breaks counter", () => {
      const withBreaks: PomodoroTimer = {
        ...initialPomodoroTimer,
        breaks: 2,
        mode: "short-break",
        status: "running",
        remaining: 50
      };
      const next = pomodoroReducer(withBreaks, { type: "pomo-reset" });
      expect(next.breaks).toBe(2);
    });
  });

  describe("pomo-tick", () => {
    it("decrements remaining by 1 when running", () => {
      const running: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "running",
        remaining: 500
      };
      const next = pomodoroReducer(running, { type: "pomo-tick" });
      expect(next.remaining).toBe(499);
    });

    it("is a no-op when paused", () => {
      const paused: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "paused",
        remaining: 100
      };
      const next = pomodoroReducer(paused, { type: "pomo-tick" });
      expect(next).toBe(paused);
    });

    it("auto-advances focus to short-break when time hits zero", () => {
      const last: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "focus",
        status: "running",
        remaining: 1
      };
      const next = pomodoroReducer(last, { type: "pomo-tick" });
      expect(next.mode).toBe("short-break");
      expect(next.status).toBe("running");
      expect(next.remaining).toBe(POMODORO_DURATIONS["short-break"]);
    });

    it("auto-advances focus to long-break every 4th cycle", () => {
      const beforeFourth: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "focus",
        status: "running",
        remaining: 1,
        cycles: 3
      };
      const next = pomodoroReducer(beforeFourth, { type: "pomo-tick" });
      expect(next.mode).toBe("long-break");
      expect(next.cycles).toBe(4);
      expect(next.remaining).toBe(POMODORO_DURATIONS["long-break"]);
    });

    it("auto-advances short-break to focus when time hits zero", () => {
      const inBreak: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "short-break",
        status: "running",
        remaining: 1,
        cycles: 1
      };
      const next = pomodoroReducer(inBreak, { type: "pomo-tick" });
      expect(next.mode).toBe("focus");
      expect(next.remaining).toBe(POMODORO_DURATIONS.focus);
    });

    it("increments breaks when long-break phase completes", () => {
      const inLongBreak: PomodoroTimer = {
        ...initialPomodoroTimer,
        mode: "long-break",
        status: "running",
        remaining: 1,
        breaks: 0
      };
      const next = pomodoroReducer(inLongBreak, { type: "pomo-tick" });
      expect(next.breaks).toBe(1);
    });
  });

  describe("pomo-set-mode", () => {
    it("changes to short-break and resets remaining", () => {
      const running: PomodoroTimer = {
        ...initialPomodoroTimer,
        status: "running",
        remaining: 100
      };
      const next = pomodoroReducer(running, {
        type: "pomo-set-mode",
        mode: "short-break"
      });
      expect(next.mode).toBe("short-break");
      expect(next.remaining).toBe(POMODORO_DURATIONS["short-break"]);
      expect(next.status).toBe("idle");
    });
  });

  describe("isPomodoroActive", () => {
    it("returns true when running", () => {
      expect(
        isPomodoroActive({ ...initialPomodoroTimer, status: "running" })
      ).toBe(true);
    });

    it("returns true when paused", () => {
      expect(
        isPomodoroActive({ ...initialPomodoroTimer, status: "paused" })
      ).toBe(true);
    });

    it("returns false when idle", () => {
      expect(isPomodoroActive(initialPomodoroTimer)).toBe(false);
    });
  });
});
