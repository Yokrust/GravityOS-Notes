import type {
  AppearanceAccent,
  AppearanceCustomAccent,
  AppearanceGradientPoint,
  AppearanceHarmony,
  AppearancePreferences,
  AppearanceScheme,
  AppearanceTheme,
  PersistencePort
} from "../../contracts/index.js";

export type {
  AppearanceAccent,
  AppearanceCustomAccent,
  AppearancePresetAccent,
  AppearanceTheme
} from "../../contracts/index.js";

const SCHEMES = new Set<AppearanceScheme>(["auto", "light", "dark"]);
const THEMES = new Set<AppearanceTheme>([
  "grafito",
  "porcelana",
  "cristal",
  "cristal-noche"
]);
const ACCENTS = new Set<AppearanceAccent>([
  "violeta",
  "azul",
  "menta",
  "ambar",
  "rosa",
  "custom"
]);
const HARMONIES = new Set<AppearanceHarmony>([
  "complementary",
  "singleAnalogous",
  "splitComplementary",
  "analogous",
  "triadic",
  "floating"
]);

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  accent: "violeta",
  customAccent: { h: 256, s: 88, l: 76 },
  harmony: "analogous",
  opacity: 0.3,
  points: [{ x: 0.56, y: -0.32 }],
  rotation: -45,
  scheme: "dark",
  theme: "grafito",
  texture: 0.06,
  version: 1
};

export class AppearancePreferencesService {
  constructor(private readonly persistence: PersistencePort) {}

  async hydrate(): Promise<AppearancePreferences> {
    const state = await this.persistence.loadState();
    return normalizeAppearancePreferences(
      state.appMetadata.appearancePreferences
    );
  }

  async save(input: unknown): Promise<AppearancePreferences> {
    const appearancePreferences = normalizeAppearancePreferences(input);
    await this.persistence.updateAppMetadata({
      appearancePreferences
    });
    return appearancePreferences;
  }
}

export function normalizeAppearancePreferences(
  input: unknown
): AppearancePreferences {
  const record = isRecord(input) ? input : {};
  const scheme = SCHEMES.has(record["scheme"] as AppearanceScheme)
    ? (record["scheme"] as AppearanceScheme)
    : DEFAULT_APPEARANCE_PREFERENCES.scheme;
  const theme = THEMES.has(record["theme"] as AppearanceTheme)
    ? (record["theme"] as AppearanceTheme)
    : scheme === "light"
      ? "porcelana"
      : "grafito";
  const points = Array.isArray(record["points"])
    ? record["points"]
        .map(normalizePoint)
        .filter((point): point is AppearanceGradientPoint => point !== null)
    : [];

  return {
    accent: ACCENTS.has(record["accent"] as AppearanceAccent)
      ? (record["accent"] as AppearanceAccent)
      : DEFAULT_APPEARANCE_PREFERENCES.accent,
    customAccent: normalizeCustomAccent(record["customAccent"]),
    harmony: HARMONIES.has(record["harmony"] as AppearanceHarmony)
      ? (record["harmony"] as AppearanceHarmony)
      : DEFAULT_APPEARANCE_PREFERENCES.harmony,
    opacity: clampNumber(
      record["opacity"],
      0.2,
      1,
      DEFAULT_APPEARANCE_PREFERENCES.opacity
    ),
    points:
      points.length > 0
        ? points.slice(0, 5)
        : DEFAULT_APPEARANCE_PREFERENCES.points.map((point) => ({ ...point })),
    rotation: clampNumber(
      record["rotation"],
      -180,
      180,
      DEFAULT_APPEARANCE_PREFERENCES.rotation
    ),
    scheme,
    theme:
      scheme === "auto"
        ? theme
        : resolveAppearanceTheme(theme, scheme === "dark"),
    texture: clampNumber(
      record["texture"],
      0,
      0.45,
      DEFAULT_APPEARANCE_PREFERENCES.texture
    ),
    version: 1
  };
}

export function resolveAppearanceTheme(
  theme: AppearanceTheme,
  prefersDark: boolean
): AppearanceTheme {
  const isCristal = theme === "cristal" || theme === "cristal-noche";
  if (isCristal) {
    return prefersDark ? "cristal-noche" : "cristal";
  }
  return prefersDark ? "grafito" : "porcelana";
}

export function selectAppearanceTheme(
  preferences: AppearancePreferences,
  theme: AppearanceTheme
): AppearancePreferences {
  return {
    ...preferences,
    scheme: theme === "grafito" || theme === "cristal-noche" ? "dark" : "light",
    theme
  };
}

export function selectAppearanceScheme(
  preferences: AppearancePreferences,
  scheme: AppearanceScheme,
  prefersDark: boolean
): AppearancePreferences {
  const isDark = scheme === "dark" || (scheme === "auto" && prefersDark);
  return {
    ...preferences,
    scheme,
    theme: resolveAppearanceTheme(preferences.theme, isDark)
  };
}

export function selectAppearanceAccent(
  preferences: AppearancePreferences,
  accent: AppearanceAccent
): AppearancePreferences {
  return { ...preferences, accent };
}

export function selectCustomAppearanceAccent(
  preferences: AppearancePreferences,
  customAccent: AppearanceCustomAccent
): AppearancePreferences {
  return {
    ...preferences,
    accent: "custom",
    customAccent: normalizeCustomAccent(customAccent)
  };
}

function normalizeCustomAccent(input: unknown): AppearanceCustomAccent {
  const record = isRecord(input) ? input : {};
  return {
    h: Math.round(
      normalizeHue(record["h"], DEFAULT_APPEARANCE_PREFERENCES.customAccent.h)
    ),
    s: Math.round(
      clampNumber(
        record["s"],
        0,
        100,
        DEFAULT_APPEARANCE_PREFERENCES.customAccent.s
      )
    ),
    l: Math.round(
      clampNumber(
        record["l"],
        0,
        100,
        DEFAULT_APPEARANCE_PREFERENCES.customAccent.l
      )
    )
  };
}

function normalizeHue(input: unknown, fallback: number): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return fallback;
  }
  return ((input % 360) + 360) % 360;
}

function normalizePoint(input: unknown): AppearanceGradientPoint | null {
  if (!isRecord(input)) {
    return null;
  }

  const x = clampNumber(input["x"], -1, 1, Number.NaN);
  const y = clampNumber(input["y"], -1, 1, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1) {
    return { x, y };
  }

  return {
    x: x / magnitude,
    y: y / magnitude
  };
}

function clampNumber(
  input: unknown,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, input));
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
