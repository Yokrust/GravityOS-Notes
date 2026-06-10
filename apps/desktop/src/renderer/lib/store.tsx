"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import type {
  FileNode,
  NoteId,
  QuickNote,
  Reminder,
  ReminderRecurrence,
  Satellite,
  SatelliteKind,
  SatelliteMeta
} from "./types";
import { reminderFiresNow } from "./reminder-utils";
import {
  type PomodoroMode,
  type PomodoroTimer,
  initialPomodoroTimer,
  pomodoroReducer
} from "./pomodoro-timer";
import { loadSatelliteData, saveSatelliteData } from "./satellite-persistence";
import { canvasRef } from "./canvas-ref";

function playPomodoroSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // AudioContext unavailable
  }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

interface State {
  tree: FileNode[];
  activeNoteId: NoteId | null;
  activeNote: FileNode | null;
  expandedFolders: Record<string, boolean>;
  notebookName: string | null;
  notebookRoot: string | null;
  notebookStatus: "ready" | "missing" | "unreadable" | null;
  notesError: string | null;
  notesLoading: boolean;
  satellites: Satellite[];
  quickNotes: QuickNote[];
  reminders: Reminder[];
  pomodoroTimer: PomodoroTimer;
  sidebarOpen: boolean;
  hubOpen: boolean;
  paletteOpen: boolean;
  zCounter: number;
}

type Action =
  | { type: "hydrate-notebook"; state: NotesStateRecord }
  | { type: "set-notes-error"; message: string | null }
  | { type: "set-notes-loading"; loading: boolean }
  | { type: "select"; id: NoteId }
  | { type: "toggle-folder"; id: string }
  | { type: "update-content"; id: NoteId; content: string }
  | { type: "toggle-sidebar" }
  | { type: "toggle-hub" }
  | { type: "set-hub"; open: boolean }
  | { type: "set-palette"; open: boolean }
  | { type: "spawn-satellite"; kind: SatelliteKind; x?: number; y?: number }
  | { type: "close-satellite"; id: string }
  | { type: "move-satellite"; id: string; x: number; y: number }
  | { type: "resize-satellite"; id: string; width: number; height: number }
  | { type: "focus-satellite"; id: string }
  | { type: "set-satellite-meta"; id: string; meta: Partial<SatelliteMeta> }
  | { type: "create-quick-note"; id: string }
  | {
      type: "update-quick-note";
      id: string;
      patch: Partial<Pick<QuickNote, "title" | "content">>;
    }
  | { type: "delete-quick-note"; id: string }
  | {
      type: "add-reminder";
      date: string;
      time: string;
      text: string;
      recurrence: ReminderRecurrence;
    }
  | { type: "delete-reminder"; id: string }
  | { type: "pomo-start" }
  | { type: "pomo-pause" }
  | { type: "pomo-reset" }
  | { type: "pomo-tick" }
  | { type: "pomo-set-mode"; mode: PomodoroMode };

const initialState: State = {
  tree: [],
  activeNote: null,
  activeNoteId: null,
  expandedFolders: {},
  notebookName: null,
  notebookRoot: null,
  notebookStatus: null,
  notesError: null,
  notesLoading: true,
  satellites: [],
  quickNotes: [
    {
      id: "qn-seed",
      title: "Sin título",
      content: "",
      updatedAt: Date.now()
    }
  ],
  reminders: [],
  pomodoroTimer: initialPomodoroTimer,
  sidebarOpen: true,
  hubOpen: false,
  paletteOpen: false,
  zCounter: 10
};

function normalizeNotesState(
  state: NotesStateRecord
): Pick<
  State,
  | "tree"
  | "activeNote"
  | "activeNoteId"
  | "expandedFolders"
  | "notebookName"
  | "notebookRoot"
  | "notebookStatus"
> {
  return {
    tree: state.tree.map(cloneNoteTreeNode),
    activeNote: state.activeNote
      ? {
          ...state.activeNote,
          type: "note"
        }
      : null,
    activeNoteId: state.activeNoteId,
    expandedFolders: { ...state.expandedFolders },
    notebookName: state.notebookName,
    notebookRoot: state.notebookRoot,
    notebookStatus: state.pathStatus
  };
}

function cloneNoteTreeNode(node: NoteTreeNodeRecord): FileNode {
  return {
    id: node.id,
    name: node.name,
    path: node.path,
    type: node.type,
    ...(node.children
      ? { children: node.children.map(cloneNoteTreeNode) }
      : {}),
    ...(node.updatedAt === undefined ? {} : { updatedAt: node.updatedAt })
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate-notebook":
      return {
        ...state,
        ...normalizeNotesState(action.state),
        notesError: null,
        notesLoading: false
      };
    case "set-notes-error":
      return { ...state, notesError: action.message, notesLoading: false };
    case "set-notes-loading":
      return { ...state, notesLoading: action.loading };
    case "select":
      return { ...state, activeNoteId: action.id };
    case "toggle-folder":
      return {
        ...state,
        expandedFolders: {
          ...state.expandedFolders,
          [action.id]: !state.expandedFolders[action.id]
        }
      };
    case "update-content":
      return {
        ...state,
        activeNote:
          state.activeNote?.id === action.id
            ? {
                ...state.activeNote,
                content: action.content,
                updatedAt: Date.now()
              }
            : state.activeNote
      };
    case "toggle-sidebar":
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case "toggle-hub":
      return { ...state, hubOpen: !state.hubOpen };
    case "set-hub":
      return { ...state, hubOpen: action.open };
    case "set-palette":
      return { ...state, paletteOpen: action.open };
    case "spawn-satellite": {
      if (action.kind === "pomodoro" || action.kind === "calendar") {
        const existing = state.satellites.find(
          (sat) => sat.kind === action.kind
        );
        if (existing) {
          const z = state.zCounter + 1;
          return {
            ...state,
            zCounter: z,
            hubOpen: false,
            satellites: state.satellites.map((sat) =>
              sat.id === existing.id ? { ...sat, z } : sat
            )
          };
        }
      }
      const z = state.zCounter + 1;
      const baseSize: Record<SatelliteKind, { w: number; h: number }> = {
        "quick-note": { w: 320, h: 360 },
        calendar: { w: 320, h: 400 },
        pomodoro: { w: 290, h: 380 }
      };
      const { w, h } = baseSize[action.kind];
      const canvas = canvasRef.current?.getBoundingClientRect();
      const cw = canvas?.width ?? 900;
      const ch = canvas?.height ?? 700;
      const grabX = 28;
      const grabY = 16;
      const seed = state.satellites.length;
      const jitterX = ((seed * 53) % 160) - 80;
      const jitterY = ((seed * 89) % 140) - 70;
      const defaultX = Math.max(20, (cw - w) / 2 + jitterX);
      const defaultY = Math.max(20, (ch - h) / 2 + jitterY);
      const rawX = action.x !== undefined ? action.x - grabX : defaultX;
      const rawY = action.y !== undefined ? action.y - grabY : defaultY;
      const maxX = Math.max(2, cw - w - 2);
      const maxY = Math.max(2, ch - h - 2);
      const sat: Satellite = {
        id: uid(),
        kind: action.kind,
        x: Math.max(2, Math.min(rawX, maxX)),
        y: Math.max(2, Math.min(rawY, maxY)),
        width: w,
        height: h,
        z
      };
      return {
        ...state,
        satellites: [...state.satellites, sat],
        zCounter: z,
        hubOpen: false
      };
    }
    case "close-satellite":
      return {
        ...state,
        satellites: state.satellites.filter((s) => s.id !== action.id)
      };
    case "move-satellite": {
      const target = state.satellites.find((s) => s.id === action.id);
      if (!target) return state;
      const canvas = canvasRef.current?.getBoundingClientRect();
      const cw = canvas?.width ?? Number.POSITIVE_INFINITY;
      const ch = canvas?.height ?? Number.POSITIVE_INFINITY;
      const maxX = Math.max(2, cw - target.width - 2);
      const maxY = Math.max(2, ch - target.height - 2);
      const x = Math.max(2, Math.min(action.x, maxX));
      const y = Math.max(2, Math.min(action.y, maxY));
      return {
        ...state,
        satellites: state.satellites.map((s) =>
          s.id === action.id ? { ...s, x, y } : s
        )
      };
    }
    case "resize-satellite":
      return {
        ...state,
        satellites: state.satellites.map((s) =>
          s.id === action.id
            ? { ...s, width: action.width, height: action.height }
            : s
        )
      };
    case "focus-satellite": {
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        satellites: state.satellites.map((s) =>
          s.id === action.id ? { ...s, z } : s
        )
      };
    }
    case "set-satellite-meta":
      return {
        ...state,
        satellites: state.satellites.map((s) =>
          s.id === action.id
            ? { ...s, meta: { ...(s.meta ?? {}), ...action.meta } }
            : s
        )
      };
    case "create-quick-note": {
      const note: QuickNote = {
        id: action.id,
        title: "Sin título",
        content: "",
        updatedAt: Date.now()
      };
      return { ...state, quickNotes: [note, ...state.quickNotes] };
    }
    case "update-quick-note":
      return {
        ...state,
        quickNotes: state.quickNotes.map((n) =>
          n.id === action.id
            ? { ...n, ...action.patch, updatedAt: Date.now() }
            : n
        )
      };
    case "delete-quick-note": {
      const remaining = state.quickNotes.filter((n) => n.id !== action.id);
      return { ...state, quickNotes: remaining };
    }
    case "add-reminder": {
      const id = uid();
      const r: Reminder = {
        id,
        seriesId: id,
        date: action.date,
        time: action.time,
        text: action.text,
        recurrence: action.recurrence,
        createdAt: Date.now()
      };
      return { ...state, reminders: [...state.reminders, r] };
    }
    case "delete-reminder": {
      const target = state.reminders.find((r) => r.id === action.id);
      const seriesId = target?.seriesId ?? action.id;
      return {
        ...state,
        reminders: state.reminders.filter((r) => r.seriesId !== seriesId)
      };
    }
    case "pomo-start":
    case "pomo-pause":
    case "pomo-reset":
    case "pomo-tick":
      return {
        ...state,
        pomodoroTimer: pomodoroReducer(state.pomodoroTimer, action)
      };
    case "pomo-set-mode":
      return {
        ...state,
        pomodoroTimer: pomodoroReducer(state.pomodoroTimer, action)
      };
    default:
      return state;
  }
}

interface StoreContextValue extends State {
  selectNote: (id: NoteId) => void;
  toggleFolder: (id: string) => void;
  addNote: (parentId?: string, name?: string) => void;
  addFolder: (parentId?: string, name?: string) => void;
  renameNode: (id: string, name: string) => void;
  deleteNode: (id: string) => void;
  updateContent: (id: NoteId, content: string) => void;
  chooseNotebookRoot: () => void;
  refreshNotebook: () => void;
  toggleSidebar: () => void;
  toggleHub: () => void;
  setHub: (open: boolean) => void;
  setPalette: (open: boolean) => void;
  spawnSatellite: (kind: SatelliteKind, x?: number, y?: number) => void;
  closeSatellite: (id: string) => void;
  moveSatellite: (id: string, x: number, y: number) => void;
  resizeSatellite: (id: string, width: number, height: number) => void;
  focusSatellite: (id: string) => void;
  setSatelliteMeta: (id: string, meta: Partial<SatelliteMeta>) => void;
  createQuickNote: () => string;
  updateQuickNote: (
    id: string,
    patch: Partial<Pick<QuickNote, "title" | "content">>
  ) => void;
  deleteQuickNote: (id: string) => void;
  addReminder: (
    date: string,
    time: string,
    text: string,
    recurrence: ReminderRecurrence
  ) => void;
  deleteReminder: (id: string) => void;
  pomodoroStart: () => void;
  pomodoroPause: () => void;
  pomodoroReset: () => void;
  pomodoroSetMode: (mode: PomodoroMode) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted =
      typeof localStorage !== "undefined"
        ? loadSatelliteData(localStorage)
        : null;
    return {
      ...initialState,
      quickNotes: persisted?.quickNotes ?? initialState.quickNotes,
      reminders: persisted?.reminders ?? initialState.reminders,
      pomodoroTimer: {
        ...initialPomodoroTimer,
        cycles: persisted?.pomodoroCycles ?? 0,
        breaks: persisted?.pomodoroBreaks ?? 0
      }
    };
  });
  const [notesSyncReady, setNotesSyncReady] = useState(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    saveSatelliteData(
      {
        quickNotes: state.quickNotes,
        reminders: state.reminders,
        pomodoroCycles: state.pomodoroTimer.cycles,
        pomodoroBreaks: state.pomodoroTimer.breaks
      },
      localStorage
    );
  }, [
    state.quickNotes,
    state.reminders,
    state.pomodoroTimer.cycles,
    state.pomodoroTimer.breaks
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.gravity?.getNotesState) {
      dispatch({ type: "set-notes-loading", loading: false });
      setNotesSyncReady(true);
      return;
    }

    let isCancelled = false;

    void window.gravity
      .getNotesState()
      .then((persistedNotes) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          type: "hydrate-notebook",
          state: persistedNotes
        });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          dispatch({
            type: "set-notes-error",
            message: getErrorMessage(error)
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setNotesSyncReady(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notesSyncReady || typeof window === "undefined") {
      return;
    }

    const save = window.gravity?.saveNotesNavigation;
    if (!save) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void save({
        activeNoteId: state.activeNoteId,
        expandedFolders: state.expandedFolders
      }).catch(() => {});
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [notesSyncReady, state.activeNoteId, state.expandedFolders]);

  useEffect(() => {
    if (state.pomodoroTimer.status !== "running") return;
    const id = window.setInterval(() => {
      dispatch({ type: "pomo-tick" });
    }, 1000);
    return () => clearInterval(id);
  }, [state.pomodoroTimer.status]);

  const pomodoroCompletionTick = state.pomodoroTimer.completionTick;
  const pomodoroMode = state.pomodoroTimer.mode;
  const prevCompletionTickRef = useRef(pomodoroCompletionTick);
  useEffect(() => {
    if (pomodoroCompletionTick === prevCompletionTickRef.current) return;
    prevCompletionTickRef.current = pomodoroCompletionTick;
    const message =
      pomodoroMode === "focus"
        ? "¡A enfocarte! Ciclo de foco (25 min)"
        : pomodoroMode === "short-break"
          ? "¡Buen trabajo! Tómate un descanso (5 min)"
          : "¡Gran sesión! Descanso largo (15 min)";
    if (typeof window !== "undefined" && "Notification" in window) {
      const fire = () => new Notification("Pomodoro", { body: message });
      if (Notification.permission === "granted") {
        fire();
      } else if (Notification.permission !== "denied") {
        void Notification.requestPermission().then((permission) => {
          if (permission === "granted") fire();
        });
      }
    }
    playPomodoroSound();
  }, [pomodoroCompletionTick, pomodoroMode]);

  const remindersRef = useRef(state.reminders);
  useEffect(() => {
    remindersRef.current = state.reminders;
  }, [state.reminders]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const reminder of remindersRef.current) {
        if (!reminderFiresNow(reminder, now)) continue;
        const fire = () =>
          new Notification("Recordatorio", { body: reminder.text });
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            fire();
          } else if (Notification.permission !== "denied") {
            void Notification.requestPermission().then((permission) => {
              if (permission === "granted") fire();
            });
          }
        }
      }
    };
    const id = window.setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      selectNote: (id) => {
        dispatch({ type: "select", id });
        const select = window.gravity?.selectNotebookNote;
        if (!select) return;
        dispatch({ type: "set-notes-loading", loading: true });
        void select(id)
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      toggleFolder: (id) => dispatch({ type: "toggle-folder", id }),
      addNote: (parentId) => {
        const create = window.gravity?.createNotebookNote;
        if (!create) return;
        dispatch({ type: "set-notes-loading", loading: true });
        void create(parentId)
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      addFolder: (parentId) => {
        const create = window.gravity?.createNotebookFolder;
        if (!create) return;
        dispatch({ type: "set-notes-loading", loading: true });
        void create(parentId)
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      renameNode: (id, name) => {
        const rename = window.gravity?.renameNotebookNode;
        if (!rename) return;
        void rename(id, name)
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      deleteNode: (id) => {
        const remove = window.gravity?.deleteNotebookNode;
        if (!remove) return;
        dispatch({ type: "set-notes-loading", loading: true });
        void remove(id)
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      updateContent: (id, content) => {
        dispatch({ type: "update-content", id, content });
        void window.gravity
          ?.saveNotebookNote(id, content)
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      chooseNotebookRoot: () => {
        const choose = window.gravity?.chooseNotebookDirectory;
        const attach = window.gravity?.attachNotebook;
        if (!choose || !attach) return;
        void choose()
          .then((notebookRoot) => {
            if (!notebookRoot) return null;
            dispatch({ type: "set-notes-loading", loading: true });
            return attach(notebookRoot);
          })
          .then((nextState) => {
            if (nextState) {
              dispatch({ type: "hydrate-notebook", state: nextState });
            }
          })
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      refreshNotebook: () => {
        const refresh = window.gravity?.refreshNotebook;
        if (!refresh) return;
        dispatch({ type: "set-notes-loading", loading: true });
        void refresh()
          .then((nextState) =>
            dispatch({ type: "hydrate-notebook", state: nextState })
          )
          .catch((error: unknown) =>
            dispatch({
              type: "set-notes-error",
              message: getErrorMessage(error)
            })
          );
      },
      toggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
      toggleHub: () => dispatch({ type: "toggle-hub" }),
      setHub: (open) => dispatch({ type: "set-hub", open }),
      setPalette: (open) => dispatch({ type: "set-palette", open }),
      spawnSatellite: (kind, x, y) =>
        dispatch({
          type: "spawn-satellite",
          kind,
          ...(x === undefined ? {} : { x }),
          ...(y === undefined ? {} : { y })
        }),
      closeSatellite: (id) => dispatch({ type: "close-satellite", id }),
      moveSatellite: (id, x, y) =>
        dispatch({ type: "move-satellite", id, x, y }),
      resizeSatellite: (id, width, height) =>
        dispatch({ type: "resize-satellite", id, width, height }),
      focusSatellite: (id) => dispatch({ type: "focus-satellite", id }),
      setSatelliteMeta: (id, meta) =>
        dispatch({ type: "set-satellite-meta", id, meta }),
      createQuickNote: () => {
        const id = uid();
        dispatch({ type: "create-quick-note", id });
        return id;
      },
      updateQuickNote: (id, patch) =>
        dispatch({ type: "update-quick-note", id, patch }),
      deleteQuickNote: (id) => dispatch({ type: "delete-quick-note", id }),
      addReminder: (date, time, text, recurrence) =>
        dispatch({ type: "add-reminder", date, time, text, recurrence }),
      deleteReminder: (id) => dispatch({ type: "delete-reminder", id }),
      pomodoroStart: () => dispatch({ type: "pomo-start" }),
      pomodoroPause: () => dispatch({ type: "pomo-pause" }),
      pomodoroReset: () => dispatch({ type: "pomo-reset" }),
      pomodoroSetMode: (mode) => dispatch({ type: "pomo-set-mode", mode })
    }),
    [state]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo actualizar el cuaderno.";
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useNoteSearch(query: string): FileNode[] {
  const { tree } = useStore();
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: FileNode[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.type === "note") {
          const hay = (n.name + " " + (n.content ?? "")).toLowerCase();
          if (!q || hay.includes(q)) out.push(n);
        }
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, query]);
}
