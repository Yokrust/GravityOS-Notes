import type { AppearancePreferences, ThemePoint } from "@gravity/application";

import {
  type RGB,
  blendColors,
  buildGradientCss,
  contrastRatio,
  harmonize,
  preferDarkText,
  rgbToHex,
  wheelPositionToColor
} from "./color-harmony.js";

const BLACK: RGB = [8, 8, 8];
const WHITE: RGB = [248, 248, 246];

export const INITIAL_APPEARANCE_PREFERENCES: AppearancePreferences = {
  harmony: "analogous",
  opacity: 0.52,
  points: [{ x: 0.56, y: -0.32 }],
  rotation: -45,
  scheme: "dark",
  texture: 0.08,
  version: 1
};

const DARK_TOKENS = {
  "--bg": "#080808",
  "--bg-paper": "#101010",
  "--danger": "#ff746c",
  "--faint": "#707070",
  "--ink": "#f5f5f5",
  "--ink-2": "#dedede",
  "--line": "#282828",
  "--line-strong": "#484848",
  "--muted": "#a1a1a1",
  "--panel": "#0c0c0c",
  "--panel-strong": "#121212",
  "--paper": "#101010",
  "--paper-soft": "rgba(16, 16, 16, 0.92)"
} as const;

const LIGHT_TOKENS = {
  "--bg": "#f4f4f2",
  "--bg-paper": "#ffffff",
  "--danger": "#b42318",
  "--faint": "#999994",
  "--ink": "#111111",
  "--ink-2": "#2a2a28",
  "--line": "#d8d8d3",
  "--line-strong": "#a9a9a2",
  "--muted": "#686864",
  "--panel": "#f0f0ed",
  "--panel-strong": "#e9e9e5",
  "--paper": "#ffffff",
  "--paper-soft": "rgba(255, 255, 255, 0.92)"
} as const;

export interface ThemePresentation {
  colors: RGB[];
  gradientCss: string;
  isDark: boolean;
  points: ThemePoint[];
  tokens: Record<string, string>;
}

export function resolveThemePoints(
  preferences: AppearancePreferences
): ThemePoint[] {
  const primary = preferences.points[0]!;
  if (preferences.harmony === "floating") {
    return preferences.points;
  }
  return [primary, ...harmonize(primary, preferences.harmony)];
}

export function resolveThemePresentation(
  preferences: AppearancePreferences,
  systemPrefersDark: boolean
): ThemePresentation {
  const isDark =
    preferences.scheme === "dark" ||
    (preferences.scheme === "auto" && systemPrefersDark);
  const points = resolveThemePoints(preferences);
  const colors = points.map((point) => wheelPositionToColor(point));
  const gradientCss =
    preferences.harmony === "floating"
      ? buildFreeGradient(colors, preferences.opacity, preferences.rotation)
      : buildGradientCss(
          colors.map((rgb) => ({ rgb })),
          {
            opacity: preferences.opacity,
            rotation: preferences.rotation
          }
        );
  const accent = ensureAccentContrast(colors[0] ?? [128, 128, 128], isDark);
  const accentInk = preferDarkText(accent) ? "#080808" : "#ffffff";
  const accentRgb = accent.join(", ");
  const baseTokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;

  return {
    colors,
    gradientCss,
    isDark,
    points,
    tokens: {
      ...baseTokens,
      "--accent": rgbToHex(accent),
      "--accent-ink": accentInk,
      "--accent-rgb": accentRgb,
      "--accent-soft": `rgba(${accentRgb}, ${isDark ? 0.16 : 0.11})`,
      "--dot": `rgba(${accentRgb}, ${isDark ? 0.18 : 0.14})`,
      "--theme-gradient": gradientCss,
      "--theme-texture": preferences.texture.toString()
    }
  };
}

export function applyThemePresentation(
  root: HTMLElement,
  presentation: ThemePresentation
): void {
  root.dataset.colorScheme = presentation.isDark ? "dark" : "light";
  root.style.colorScheme = presentation.isDark ? "dark" : "light";
  for (const [property, value] of Object.entries(presentation.tokens)) {
    root.style.setProperty(property, value);
  }
}

function buildFreeGradient(
  colors: RGB[],
  opacity: number,
  rotation: number
): string {
  if (colors.length <= 1) {
    return buildGradientCss(
      colors.map((rgb) => ({ rgb })),
      { opacity, rotation }
    );
  }

  const stops = colors.map((color, index) => {
    const position = (index / (colors.length - 1)) * 100;
    return `rgba(${color.join(", ")}, ${opacity}) ${position}%`;
  });
  return `linear-gradient(${rotation}deg, ${stops.join(", ")})`;
}

function ensureAccentContrast(color: RGB, isDark: boolean): RGB {
  const background = isDark ? BLACK : WHITE;
  const target = isDark ? WHITE : BLACK;
  let accent = color;

  for (
    let attempt = 0;
    attempt < 5 && contrastRatio(accent, background) < 3;
    attempt += 1
  ) {
    accent = blendColors(accent, target, 72);
  }

  return accent;
}
