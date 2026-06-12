import type {
  AppearanceGradientPoint,
  AppearanceHarmony,
  AppearancePreferences,
  AppearanceScheme,
  PersistencePort
} from "../../contracts/index.js";

const SCHEMES = new Set<AppearanceScheme>(["auto", "light", "dark"]);
const HARMONIES = new Set<AppearanceHarmony>([
  "complementary",
  "singleAnalogous",
  "splitComplementary",
  "analogous",
  "triadic",
  "floating"
]);

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  harmony: "analogous",
  opacity: 0.3,
  points: [{ x: 0.56, y: -0.32 }],
  rotation: -45,
  scheme: "dark",
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
    const state = await this.persistence.loadState();
    const appearancePreferences = normalizeAppearancePreferences(input);
    await this.persistence.saveAppMetadata({
      ...state.appMetadata,
      appearancePreferences
    });
    return appearancePreferences;
  }
}

export function normalizeAppearancePreferences(
  input: unknown
): AppearancePreferences {
  const record = isRecord(input) ? input : {};
  const points = Array.isArray(record["points"])
    ? record["points"]
        .map(normalizePoint)
        .filter((point): point is AppearanceGradientPoint => point !== null)
    : [];

  return {
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
    scheme: SCHEMES.has(record["scheme"] as AppearanceScheme)
      ? (record["scheme"] as AppearanceScheme)
      : DEFAULT_APPEARANCE_PREFERENCES.scheme,
    texture: clampNumber(
      record["texture"],
      0,
      0.45,
      DEFAULT_APPEARANCE_PREFERENCES.texture
    ),
    version: 1
  };
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
