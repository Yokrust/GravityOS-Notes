"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type ThemeId = "grafito" | "porcelana" | "cristal" | "cristal-noche";
export type PresetAccentId = "violeta" | "azul" | "menta" | "ambar" | "rosa";
export type AccentId = PresetAccentId | "custom";

export const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: "grafito", label: "Grafito" },
  { id: "porcelana", label: "Porcelana" },
  { id: "cristal", label: "Cristal" },
  { id: "cristal-noche", label: "Cristal Noche" }
];

/** Vidrio líquido en cualquiera de sus dos esquemas. */
export function isCristalTheme(theme: ThemeId): boolean {
  return theme.startsWith("cristal");
}

/** Matiz y saturación de cada acento; la luminosidad la decide el tema. */
export const ACCENTS: Array<{
  id: PresetAccentId;
  label: string;
  h: number;
  s: string;
}> = [
  { id: "violeta", label: "Violeta", h: 256, s: "88%" },
  { id: "azul", label: "Azul", h: 213, s: "94%" },
  { id: "menta", label: "Menta", h: 166, s: "64%" },
  { id: "ambar", label: "Ámbar", h: 36, s: "92%" },
  { id: "rosa", label: "Rosa", h: 339, s: "82%" }
];

/** Matiz y saturación de un acento libre elegido por la persona. */
export interface CustomAccent {
  h: number;
  s: number;
}

export const DEFAULT_CUSTOM_ACCENT: CustomAccent = { h: 256, s: 88 };

const THEME_KEY = "gravity.appearance.theme";
const ACCENT_KEY = "gravity.appearance.accent";
const CUSTOM_ACCENT_KEY = "gravity.appearance.accent-custom";

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));
const ACCENT_IDS = new Set<string>([
  ...ACCENTS.map((accent) => accent.id),
  "custom"
]);

function readStored<T extends string>(
  key: string,
  valid: Set<string>,
  fallback: T
): T {
  try {
    const value = localStorage.getItem(key);
    return value && valid.has(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function readCustomAccent(): CustomAccent {
  try {
    const raw = localStorage.getItem(CUSTOM_ACCENT_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_ACCENT };
    const parsed = JSON.parse(raw) as Partial<CustomAccent>;
    return normalizeCustomAccent(parsed);
  } catch {
    return { ...DEFAULT_CUSTOM_ACCENT };
  }
}

function normalizeCustomAccent(input: Partial<CustomAccent>): CustomAccent {
  const h =
    typeof input.h === "number" && Number.isFinite(input.h)
      ? ((input.h % 360) + 360) % 360
      : DEFAULT_CUSTOM_ACCENT.h;
  const s =
    typeof input.s === "number" && Number.isFinite(input.s)
      ? Math.min(100, Math.max(0, input.s))
      : DEFAULT_CUSTOM_ACCENT.s;
  return { h: Math.round(h), s: Math.round(s) };
}

interface AppearanceContextValue {
  theme: ThemeId;
  accent: AccentId;
  customAccent: CustomAccent;
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: PresetAccentId) => void;
  setCustomAccent: (accent: CustomAccent) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeId>(() =>
    readStored(THEME_KEY, THEME_IDS, "grafito")
  );
  const [accent, setAccentState] = useState<AccentId>(() =>
    readStored(ACCENT_KEY, ACCENT_IDS, "violeta")
  );
  const [customAccent, setCustomAccentState] =
    useState<CustomAccent>(readCustomAccent);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // almacenamiento no disponible
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["accent"] = accent;
    // El acento libre se inyecta como variables inline; los presets viven en
    // hojas de estilo, así que limpiamos cualquier override previo.
    if (accent === "custom") {
      root.style.setProperty("--accent-h", String(customAccent.h));
      root.style.setProperty("--accent-s", `${customAccent.s}%`);
    } else {
      root.style.removeProperty("--accent-h");
      root.style.removeProperty("--accent-s");
    }
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // almacenamiento no disponible
    }
  }, [accent, customAccent]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_ACCENT_KEY, JSON.stringify(customAccent));
    } catch {
      // almacenamiento no disponible
    }
  }, [customAccent]);

  const setTheme = useCallback((next: ThemeId) => setThemeState(next), []);
  const setAccent = useCallback(
    (next: PresetAccentId) => setAccentState(next),
    []
  );
  const setCustomAccent = useCallback((next: CustomAccent) => {
    setCustomAccentState(normalizeCustomAccent(next));
    setAccentState("custom");
  }, []);

  const value = useMemo(
    () => ({
      accent,
      customAccent,
      setAccent,
      setCustomAccent,
      setTheme,
      theme
    }),
    [accent, customAccent, setAccent, setCustomAccent, setTheme, theme]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return ctx;
}
