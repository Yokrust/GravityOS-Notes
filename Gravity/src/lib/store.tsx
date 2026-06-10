"use client";

import { createContext, useContext, useMemo, useReducer } from "react";
import type {
  FileNode,
  NoteId,
  QuickNote,
  Reminder,
  Satellite,
  SatelliteKind,
  SatelliteMeta,
} from "./types";
import { canvasRef } from "./canvas-ref";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

interface State {
  tree: FileNode[];
  activeNoteId: NoteId | null;
  expandedFolders: Record<string, boolean>;
  satellites: Satellite[];
  quickNotes: QuickNote[];
  reminders: Reminder[];
  sidebarOpen: boolean;
  hubOpen: boolean;
  paletteOpen: boolean;
  zCounter: number;
}
type Action =
  | { type: "select"; id: NoteId }
  | { type: "toggle-folder"; id: string }
  | { type: "add-note"; parentId?: string; name?: string }
  | { type: "add-folder"; parentId?: string; name?: string }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string }
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
  | { type: "update-quick-note"; id: string; patch: Partial<Pick<QuickNote, "title" | "content">> }
  | { type: "delete-quick-note"; id: string }
  | { type: "add-reminder"; date: string; text: string }
  | { type: "delete-reminder"; id: string };

function deepUpdate(
  nodes: FileNode[],
  id: string,
  fn: (n: FileNode) => FileNode | null,
): FileNode[] {
  const result: FileNode[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      const next = fn(n);
      if (next) result.push(next);
      continue;
    }
    if (n.children) {
      result.push({ ...n, children: deepUpdate(n.children, id, fn) });
    } else {
      result.push(n);
    }
  }
  return result;
}

function findNote(nodes: FileNode[], id: NoteId): FileNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNote(n.children, id);
      if (f) return f;
    }
  }
  return undefined;
}

function insertChild(
  nodes: FileNode[],
  parentId: string | undefined,
  child: FileNode,
): FileNode[] {
  if (!parentId) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId) {
      return {
        ...n,
        children: [...(n.children ?? []), child],
      };
    }
    if (n.children) {
      return { ...n, children: insertChild(n.children, parentId, child) };
    }
    return n;
  });
}

const sampleNotes: FileNode[] = [
  {
    id: "f-personal",
    name: "Personal",
    type: "folder",
    children: [
      {
        id: "n-welcome",
        name: "Bienvenido a Gravity",
        type: "note",
        updatedAt: Date.now(),
        content: `# Bienvenido a Gravity

Un espacio tranquilo para pensar, escribir y conectar ideas.

## Empieza aquí
- Pulsa **⌘ K** para abrir comandos rápidos.
- Arrastra **satélites** desde el hub superior derecho.
- Crea notas y carpetas en la barra lateral.

> "La simplicidad es la sofisticación máxima."

Escribe libremente — todo se guarda en memoria de tu sesión.`,
      },
      {
        id: "n-ideas",
        name: "Ideas sueltas",
        type: "note",
        updatedAt: Date.now() - 1000 * 60 * 60 * 6,
        content: `# Ideas sueltas

- Una app que organice mi mente
- Un espacio donde el ruido no exista
- Notas que se conecten entre sí`,
      },
    ],
  },
  {
    id: "f-work",
    name: "Trabajo",
    type: "folder",
    children: [
      {
        id: "n-roadmap",
        name: "Roadmap Q2",
        type: "note",
        updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
        content: `# Roadmap Q2

## Esta semana
- [ ] Diseño del editor
- [ ] Componente de calendario
- [ ] Reescribir el sistema de satélites

## Próximamente
- Sincronización en la nube
- Modo presentación`,
      },
    ],
  },
  {
    id: "n-diary",
    name: "Diario",
    type: "note",
    updatedAt: Date.now() - 1000 * 60 * 30,
    content: `# Diario

Hoy es un buen día para empezar.`,
  },
];

const initialState: State = {
  tree: sampleNotes,
  activeNoteId: "n-welcome",
  expandedFolders: { "f-personal": true, "f-work": true },
  satellites: [],
  quickNotes: [
    {
      id: "qn-seed",
      title: "Sin título",
      content: "",
      updatedAt: Date.now(),
    },
  ],
  reminders: [],
  sidebarOpen: true,
  hubOpen: false,
  paletteOpen: false,
  zCounter: 10,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      return { ...state, activeNoteId: action.id };
    case "toggle-folder":
      return {
        ...state,
        expandedFolders: {
          ...state.expandedFolders,
          [action.id]: !state.expandedFolders[action.id],
        },
      };
    case "add-note": {
      const node: FileNode = {
        id: uid(),
        name: action.name ?? "Nueva nota",
        type: "note",
        content: "",
        updatedAt: Date.now(),
      };
      return {
        ...state,
        tree: insertChild(state.tree, action.parentId, node),
        activeNoteId: node.id,
        expandedFolders: action.parentId
          ? { ...state.expandedFolders, [action.parentId]: true }
          : state.expandedFolders,
      };
    }
    case "add-folder": {
      const node: FileNode = {
        id: uid(),
        name: action.name ?? "Nueva carpeta",
        type: "folder",
        children: [],
      };
      return {
        ...state,
        tree: insertChild(state.tree, action.parentId, node),
        expandedFolders: { ...state.expandedFolders, [node.id]: true },
      };
    }
    case "rename":
      return {
        ...state,
        tree: deepUpdate(state.tree, action.id, (n) => ({
          ...n,
          name: action.name,
        })),
      };
    case "delete":
      return {
        ...state,
        tree: deepUpdate(state.tree, action.id, () => null),
        activeNoteId:
          state.activeNoteId === action.id ? null : state.activeNoteId,
      };
    case "update-content":
      return {
        ...state,
        tree: deepUpdate(state.tree, action.id, (n) => ({
          ...n,
          content: action.content,
          updatedAt: Date.now(),
        })),
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
      const z = state.zCounter + 1;
      const baseSize: Record<SatelliteKind, { w: number; h: number }> = {
        "quick-note": { w: 320, h: 360 },
        calendar: { w: 320, h: 400 },
        pomodoro: { w: 290, h: 380 },
      };
      const { w, h } = baseSize[action.kind];
      const canvas = canvasRef.current?.getBoundingClientRect();
      const cw = canvas?.width ?? 900;
      const ch = canvas?.height ?? 700;
      // Drop coords map pointer to just-inside-the-grip, so the satellite
      // lands right where the cursor is without snapping to edges.
      const grabX = 28;
      const grabY = 16;
      // Default (no drop coords) = loose center, jittered per satellite so
      // multiple spawns don't stack in a grid.
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
        z,
      };
      return {
        ...state,
        satellites: [...state.satellites, sat],
        zCounter: z,
        hubOpen: false,
      };
    }
    case "close-satellite":
      return {
        ...state,
        satellites: state.satellites.filter((s) => s.id !== action.id),
      };
    case "move-satellite": {
      // Keep the satellite inside the canvas regardless of how the user
      // dropped it — viewport could have resized mid-session and
      // framer-motion's elastic drag may overshoot by a few px.
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
          s.id === action.id ? { ...s, x, y } : s,
        ),
      };
    }
    case "resize-satellite":
      return {
        ...state,
        satellites: state.satellites.map((s) =>
          s.id === action.id
            ? { ...s, width: action.width, height: action.height }
            : s,
        ),
      };
    case "focus-satellite": {
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        satellites: state.satellites.map((s) =>
          s.id === action.id ? { ...s, z } : s,
        ),
      };
    }
    case "set-satellite-meta":
      return {
        ...state,
        satellites: state.satellites.map((s) =>
          s.id === action.id
            ? { ...s, meta: { ...(s.meta ?? {}), ...action.meta } }
            : s,
        ),
      };
    case "create-quick-note": {
      const note: QuickNote = {
        id: action.id,
        title: "Sin título",
        content: "",
        updatedAt: Date.now(),
      };
      return { ...state, quickNotes: [note, ...state.quickNotes] };
    }
    case "update-quick-note":
      return {
        ...state,
        quickNotes: state.quickNotes.map((n) =>
          n.id === action.id
            ? { ...n, ...action.patch, updatedAt: Date.now() }
            : n,
        ),
      };
    case "delete-quick-note": {
      const remaining = state.quickNotes.filter((n) => n.id !== action.id);
      return { ...state, quickNotes: remaining };
    }
    case "add-reminder": {
      const r: Reminder = {
        id: uid(),
        date: action.date,
        text: action.text,
        createdAt: Date.now(),
      };
      return { ...state, reminders: [...state.reminders, r] };
    }
    case "delete-reminder":
      return {
        ...state,
        reminders: state.reminders.filter((r) => r.id !== action.id),
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
  updateQuickNote: (id: string, patch: Partial<Pick<QuickNote, "title" | "content">>) => void;
  deleteQuickNote: (id: string) => void;
  addReminder: (date: string, text: string) => void;
  deleteReminder: (id: string) => void;
  activeNote: FileNode | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const activeNote = useMemo(
    () => (state.activeNoteId ? findNote(state.tree, state.activeNoteId) ?? null : null),
    [state.tree, state.activeNoteId],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      activeNote,
      selectNote: (id) => dispatch({ type: "select", id }),
      toggleFolder: (id) => dispatch({ type: "toggle-folder", id }),
      addNote: (parentId, name) =>
        dispatch({ type: "add-note", parentId, name }),
      addFolder: (parentId, name) =>
        dispatch({ type: "add-folder", parentId, name }),
      renameNode: (id, name) => dispatch({ type: "rename", id, name }),
      deleteNode: (id) => dispatch({ type: "delete", id }),
      updateContent: (id, content) =>
        dispatch({ type: "update-content", id, content }),
      toggleSidebar: () => dispatch({ type: "toggle-sidebar" }),
      toggleHub: () => dispatch({ type: "toggle-hub" }),
      setHub: (open) => dispatch({ type: "set-hub", open }),
      setPalette: (open) => dispatch({ type: "set-palette", open }),
      spawnSatellite: (kind, x, y) =>
        dispatch({ type: "spawn-satellite", kind, x, y }),
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
      addReminder: (date, text) =>
        dispatch({ type: "add-reminder", date, text }),
      deleteReminder: (id) => dispatch({ type: "delete-reminder", id }),
    }),
    [state, activeNote],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
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
