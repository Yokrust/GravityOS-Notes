"use client";

import {
  resolveAppearanceTheme,
  selectAppearanceAccent,
  selectAppearanceScheme,
  selectAppearanceTheme,
  selectCustomAppearanceAccent,
  type AppearanceAccent,
  type AppearanceCustomAccent,
  type AppearancePresetAccent,
  type AppearanceTheme
} from "@gravity/application/appearance";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  applyAmbientTheme,
  buildAmbientTheme,
  cloneDefaultAmbientPreferences
} from "./ambient.js";

export type ThemeId = AppearanceTheme;
export type PresetAccentId = AppearancePresetAccent;
export type AccentId = AppearanceAccent;
export type CustomAccent = AppearanceCustomAccent;

export const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: "grafito", label: "Grafito" },
  { id: "porcelana", label: "Porcelana" },
  { id: "cristal", label: "Cristal" },
  { id: "cristal-noche", label: "Cristal Noche" }
];

export function isCristalTheme(theme: ThemeId): boolean {
  return theme.startsWith("cristal");
}

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

export const DEFAULT_CUSTOM_ACCENT: CustomAccent = { h: 256, s: 88, l: 76 };

const THEME_KEY = "gravity.appearance.theme";
const ACCENT_KEY = "gravity.appearance.accent";
const CUSTOM_ACCENT_KEY = "gravity.appearance.accent-custom";
const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));
const ACCENT_IDS = new Set<string>([
  ...ACCENTS.map((accent) => accent.id),
  "custom"
]);

interface AppearanceContextValue {
  accent: AccentId;
  customAccent: CustomAccent;
  error: string | null;
  isHydrated: boolean;
  preferences: AppearancePreferencesRecord;
  preview: (preferences: AppearancePreferencesRecord) => void;
  reset: () => Promise<void>;
  save: (preferences: AppearancePreferencesRecord) => Promise<void>;
  selectScheme: (scheme: AppearanceSchemeRecord) => void;
  setAccent: (accent: PresetAccentId) => void;
  setCustomAccent: (accent: CustomAccent) => void;
  setTheme: (theme: ThemeId) => void;
  theme: ThemeId;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState<AppearancePreferencesRecord>(
    readCachedPreferences
  );
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [prefersDark, setPrefersDark] = useState(readSystemScheme);
  const preferencesRef = useRef(preferences);
  const revisionRef = useRef(0);
  const saveTicket = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const load = window.gravity?.getAppearancePreferences;
    if (!load) {
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    const revision = revisionRef.current;
    load()
      .then((stored) => {
        if (!cancelled && revision === revisionRef.current) {
          preferencesRef.current = stored;
          setPreferences(stored);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(describeError(cause));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const theme = resolveAppearanceTheme(
    preferences.theme,
    preferences.scheme === "dark" ||
      (preferences.scheme === "auto" && prefersDark)
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["theme"] = theme;
    root.dataset["accent"] = preferences.accent;
    if (preferences.accent === "custom") {
      // Normalize defensively so a stale persisted value missing `l` can never
      // emit invalid CSS (e.g. `hsl(... undefined%)`), which would blank the
      // accent instead of applying the chosen color.
      const customAccent = normalizeCustomAccent(preferences.customAccent);
      // Preset accents carry separate light/dark lightness so they stay legible
      // on every theme. A free color has a single lightness, so a near-black or
      // near-white pick vanishes against a same-polarity background. Clamp the
      // chosen lightness into a visible band for the active theme and derive an
      // ink that contrasts the result — preserving the color while keeping it
      // readable.
      const visibleL = visibleAccentLightness(
        theme,
        customAccent.l,
        customAccent.s
      );
      root.style.setProperty("--accent-h", String(customAccent.h));
      root.style.setProperty("--accent-s", `${customAccent.s}%`);
      root.style.setProperty("--accent-l", `${visibleL}%`);
      root.style.setProperty("--accent-ink", accentInkForLightness(visibleL));
    } else {
      root.style.removeProperty("--accent-h");
      root.style.removeProperty("--accent-s");
      root.style.removeProperty("--accent-l");
      root.style.removeProperty("--accent-ink");
    }
    applyAmbientTheme(
      root,
      buildAmbientTheme(preferences, prefersDark),
      preferences.texture
    );
    writeAppearanceCache(preferences, theme);
  }, [preferences, prefersDark, theme]);

  const preview = useCallback((next: AppearancePreferencesRecord) => {
    revisionRef.current += 1;
    preferencesRef.current = next;
    setPreferences(next);
  }, []);

  const save = useCallback(async (next: AppearancePreferencesRecord) => {
    revisionRef.current += 1;
    preferencesRef.current = next;
    setPreferences(next);
    const persist = window.gravity?.saveAppearancePreferences;
    if (!persist) return;

    const ticket = saveTicket.current + 1;
    saveTicket.current = ticket;
    let saved: AppearancePreferencesRecord | null = null;
    let failure: unknown = null;

    saveQueue.current = saveQueue.current
      .then(async () => {
        saved = await persist(next);
      })
      .catch((cause: unknown) => {
        failure = cause;
      });
    await saveQueue.current;

    if (ticket !== saveTicket.current) return;
    if (failure) {
      setError(describeError(failure));
      return;
    }
    const persisted = saved as AppearancePreferencesRecord | null;
    if (persisted) {
      // The client authored `next` with full custom-accent precision (h, s, l).
      // Prefer it over the round-tripped value so a main process that has not
      // yet been reloaded cannot drop the chosen lightness.
      const reconciled =
        next.accent === "custom" && persisted.accent === "custom"
          ? { ...persisted, customAccent: next.customAccent }
          : persisted;
      preferencesRef.current = reconciled;
      setPreferences(reconciled);
      setError(null);
    }
  }, []);

  const reset = useCallback(async () => {
    await save(cloneDefaultAmbientPreferences());
  }, [save]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      void save(selectAppearanceTheme(preferencesRef.current, next));
    },
    [save]
  );
  const setAccent = useCallback(
    (next: PresetAccentId) => {
      void save(selectAppearanceAccent(preferencesRef.current, next));
    },
    [save]
  );
  const setCustomAccent = useCallback(
    (next: CustomAccent) => {
      void save(selectCustomAppearanceAccent(preferencesRef.current, next));
    },
    [save]
  );
  const selectScheme = useCallback(
    (next: AppearanceSchemeRecord) => {
      void save(
        selectAppearanceScheme(preferencesRef.current, next, prefersDark)
      );
    },
    [prefersDark, save]
  );

  const value = useMemo(
    () => ({
      accent: preferences.accent,
      customAccent: preferences.customAccent,
      error,
      isHydrated,
      preferences,
      preview,
      reset,
      save,
      selectScheme,
      setAccent,
      setCustomAccent,
      setTheme,
      theme
    }),
    [
      error,
      isHydrated,
      preferences,
      preview,
      reset,
      save,
      selectScheme,
      setAccent,
      setCustomAccent,
      setTheme,
      theme
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return context;
}

function readCachedPreferences(): AppearancePreferencesRecord {
  const preferences = cloneDefaultAmbientPreferences();
  if (typeof localStorage === "undefined") return preferences;

  const theme = readStored(THEME_KEY, THEME_IDS, preferences.theme);
  const accent = readStored(ACCENT_KEY, ACCENT_IDS, preferences.accent);
  return selectAppearanceTheme(
    {
      ...preferences,
      accent,
      customAccent: readCustomAccent()
    },
    theme
  );
}

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

const LIGHT_THEMES = new Set<ThemeId>(["porcelana", "cristal"]);

/** Clamp a free accent's lightness into a band that stays legible on the active
 *  theme: dark themes need a light-enough accent, light themes a dark-enough
 *  one. The band is saturation-aware — a vivid color already carries contrast,
 *  so it keeps its lightness, while a near-grey gets pushed firmly into the
 *  readable range. Hue and saturation are never altered. */
function visibleAccentLightness(theme: ThemeId, l: number, s: number): number {
  const headroom = Math.round((Math.min(100, Math.max(0, s)) / 100) * 12);
  return LIGHT_THEMES.has(theme)
    ? Math.min(Math.max(l, 16), 44 + headroom)
    : Math.max(Math.min(l, 88), 60 - headroom);
}

/** Ink (text/icons) drawn on top of the accent fill: light accent → dark ink,
 *  dark accent → light ink, so buttons and checks stay readable. */
function accentInkForLightness(l: number): string {
  return l >= 58 ? "#10101a" : "#ffffff";
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
  const l =
    typeof input.l === "number" && Number.isFinite(input.l)
      ? Math.min(100, Math.max(0, input.l))
      : DEFAULT_CUSTOM_ACCENT.l;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

function writeAppearanceCache(
  preferences: AppearancePreferencesRecord,
  theme: ThemeId
): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, preferences.accent);
    localStorage.setItem(
      CUSTOM_ACCENT_KEY,
      JSON.stringify(preferences.customAccent)
    );
  } catch {
    // The persisted IPC preferences remain canonical when storage is blocked.
  }
}

function readSystemScheme(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function describeError(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "No se pudieron guardar las preferencias de apariencia.";
}
