export type PomodoroStatus = "idle" | "running" | "paused";
export type PomodoroMode = "focus" | "short-break" | "long-break";

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  "short-break": 5 * 60,
  "long-break": 15 * 60
};

export interface PomodoroTimer {
  mode: PomodoroMode;
  remaining: number;
  status: PomodoroStatus;
  cycles: number;
  breaks: number;
  completionTick: number;
}

export const initialPomodoroTimer: PomodoroTimer = {
  mode: "focus",
  remaining: POMODORO_DURATIONS.focus,
  status: "idle",
  cycles: 0,
  breaks: 0,
  completionTick: 0
};

export type PomodoroAction =
  | { type: "pomo-start" }
  | { type: "pomo-pause" }
  | { type: "pomo-reset" }
  | { type: "pomo-tick" }
  | { type: "pomo-set-mode"; mode: PomodoroMode };

export function pomodoroReducer(
  state: PomodoroTimer,
  action: PomodoroAction
): PomodoroTimer {
  switch (action.type) {
    case "pomo-start":
      if (state.status === "running") return state;
      return { ...state, status: "running" };
    case "pomo-pause":
      if (state.status !== "running") return state;
      return { ...state, status: "paused" };
    case "pomo-reset":
      return {
        ...state,
        mode: "focus",
        remaining: POMODORO_DURATIONS.focus,
        status: "idle"
      };
    case "pomo-tick": {
      if (state.status !== "running") return state;
      const next = state.remaining - 1;
      if (next <= 0) {
        if (state.mode === "focus") {
          const newCycles = state.cycles + 1;
          const nextMode: PomodoroMode =
            newCycles % 4 === 0 ? "long-break" : "short-break";
          return {
            ...state,
            mode: nextMode,
            remaining: POMODORO_DURATIONS[nextMode],
            status: "running",
            cycles: newCycles,
            completionTick: state.completionTick + 1
          };
        }
        return {
          ...state,
          mode: "focus",
          remaining: POMODORO_DURATIONS.focus,
          status: "running",
          breaks: state.breaks + 1,
          completionTick: state.completionTick + 1
        };
      }
      return { ...state, remaining: next };
    }
    case "pomo-set-mode":
      return {
        ...state,
        mode: action.mode,
        remaining: POMODORO_DURATIONS[action.mode],
        status: "idle"
      };
    default:
      return state;
  }
}

export function isPomodoroActive(timer: PomodoroTimer): boolean {
  return timer.status !== "idle";
}
