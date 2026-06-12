/**
 * Motor de ambiente generativo ("zen"): convierte las preferencias de
 * apariencia (puntos de color sobre una rueda, armonía, opacidad, textura)
 * en un degradado CSS que se proyecta detrás de toda la interfaz.
 */

export type Rgb = [number, number, number];

export const HARMONY_ANGLES: Array<{
  type: AppearanceHarmonyRecord;
  angles: number[];
}> = [
  { type: "complementary", angles: [180] },
  { type: "singleAnalogous", angles: [310] },
  { type: "splitComplementary", angles: [150, 210] },
  { type: "analogous", angles: [50, 310] },
  { type: "triadic", angles: [120, 240] },
  { type: "floating", angles: [] }
];

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;
const DARK_SURFACE: Rgb = [8, 8, 8];
const LIGHT_SURFACE: Rgb = [248, 248, 246];

export const DEFAULT_AMBIENT_PREFERENCES: AppearancePreferencesRecord = {
  harmony: "analogous",
  opacity: 0.3,
  points: [{ x: 0.56, y: -0.32 }],
  rotation: -45,
  scheme: "dark",
  texture: 0.06,
  version: 1
};

export function cloneDefaultAmbientPreferences(): AppearancePreferencesRecord {
  return {
    ...DEFAULT_AMBIENT_PREFERENCES,
    points: DEFAULT_AMBIENT_PREFERENCES.points.map((point) => ({ ...point }))
  };
}

function hueToChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const { round } = Math;
  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToChannel(p, q, h + 1 / 3);
    g = hueToChannel(p, q, h);
    b = hueToChannel(p, q, h - 1 / 3);
  }

  return [round(r * 255), round(g * 255), round(b * 255)];
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta === 0) hue = 0;
  else if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  const lightness = (min + max) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return [hue * 60, saturation, lightness];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function mixRgb(target: Rgb, base: Rgb, percentage: number): Rgb {
  const ratio = percentage / 100;
  return [
    Math.round(target[0] * ratio + base[0] * (1 - ratio)),
    Math.round(target[1] * ratio + base[1] * (1 - ratio)),
    Math.round(target[2] * ratio + base[2] * (1 - ratio))
  ];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((value) => {
    value /= 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
}

export function contrastRatio(left: Rgb, right: Rgb): number {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

export function pointAngle(point: AppearanceGradientPointRecord): number {
  return (Math.atan2(point.y, point.x) * DEG_PER_RAD + 360) % 360;
}

export function pointRadius(point: AppearanceGradientPointRecord): number {
  return Math.min(1, Math.hypot(point.x, point.y));
}

/** Convierte un punto de la rueda (ángulo = tono, radio = intensidad) a RGB. */
export function pointToRgb(point: AppearanceGradientPointRecord): Rgb {
  const softness = 1 - pointRadius(point);
  const hue = pointAngle(point);
  const saturation = 90 + (1 - softness) * 10;
  const lightness = Math.round((1 - softness) * 100);
  const [r, g, b] = hslToRgb(hue / 360, saturation / 100, lightness / 100);
  return [
    Math.min(255, Math.max(0, r)),
    Math.min(255, Math.max(0, g)),
    Math.min(255, Math.max(0, b))
  ];
}

/**
 * Inversa de pointToRgb: la rueda codifica el tono en el ángulo y la
 * intensidad (luminosidad) en el radio, así que un color elegido en el
 * selector debe volver al radio = luminosidad — usar la saturación lo
 * empujaba al borde y lo volvía blanco.
 */
export function rgbToPoint(rgb: Rgb): AppearanceGradientPointRecord {
  const [hue, , lightness] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const radius = Math.min(1, Math.max(0, lightness));
  const radians = hue * RAD_PER_DEG;
  return {
    x: radius * Math.cos(radians),
    y: radius * Math.sin(radians)
  };
}

export function harmonyPoints(
  base: AppearanceGradientPointRecord,
  harmony: AppearanceHarmonyRecord
): AppearanceGradientPointRecord[] {
  const definition = HARMONY_ANGLES.find((entry) => entry.type === harmony);
  if (!definition || definition.angles.length === 0) return [];
  const angle = pointAngle(base);
  const radius = pointRadius(base);
  return definition.angles.map((offset) => {
    const radians = ((angle + offset) % 360) * RAD_PER_DEG;
    return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) };
  });
}

export function resolveAmbientPoints(
  preferences: AppearancePreferencesRecord
): AppearanceGradientPointRecord[] {
  const primary = preferences.points[0];
  if (!primary) return [];
  return preferences.harmony === "floating"
    ? preferences.points
    : [primary, ...harmonyPoints(primary, preferences.harmony)];
}

function rgbaString([r, g, b]: Rgb, opacity: number): string {
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function layeredGradient(
  colors: Rgb[],
  opacity: number,
  rotation: number
): string {
  const paint = (rgb: Rgb) => rgbaString(rgb, opacity);
  const [first, second, third] = colors;
  if (!first) return "transparent";
  if (colors.length === 1) return paint(first);
  if (colors.length === 2 || !third) {
    return [
      `linear-gradient(${rotation}deg, ${paint(second as Rgb)} 0%, transparent 100%)`,
      `linear-gradient(${rotation + 180}deg, ${paint(first)} 0%, transparent 100%)`
    ]
      .reverse()
      .join(", ");
  }
  return [
    `linear-gradient(-5deg, ${paint(third)} 10%, transparent 80%)`,
    `radial-gradient(circle at 95% 0%, ${paint(second as Rgb)} 0%, transparent 75%)`,
    `radial-gradient(circle at 0% 0%, ${paint(first)} 10%, transparent 70%)`
  ].join(", ");
}

function floatingGradient(
  colors: Rgb[],
  opacity: number,
  rotation: number
): string {
  if (colors.length <= 1) {
    return layeredGradient(colors, opacity, rotation);
  }
  const stops = colors.map((rgb, index) => {
    const position = (index / (colors.length - 1)) * 100;
    return `rgba(${rgb.join(", ")}, ${opacity}) ${position}%`;
  });
  return `linear-gradient(${rotation}deg, ${stops.join(", ")})`;
}

/** Acerca el color a la superficie opuesta hasta lograr contraste legible. */
export function ensureContrast(color: Rgb, isDark: boolean): Rgb {
  const surface = isDark ? DARK_SURFACE : LIGHT_SURFACE;
  const counterpart = isDark ? LIGHT_SURFACE : DARK_SURFACE;
  let adjusted = color;
  for (
    let step = 0;
    step < 5 && contrastRatio(adjusted, surface) < 3;
    step += 1
  ) {
    adjusted = mixRgb(adjusted, counterpart, 72);
  }
  return adjusted;
}

export interface AmbientTheme {
  colors: Rgb[];
  gradientCss: string;
  isDark: boolean;
  points: AppearanceGradientPointRecord[];
  accent: Rgb;
}

export function buildAmbientTheme(
  preferences: AppearancePreferencesRecord,
  prefersDark: boolean
): AmbientTheme {
  const isDark =
    preferences.scheme === "dark" ||
    (preferences.scheme === "auto" && prefersDark);
  const points = resolveAmbientPoints(preferences);
  const colors = points.map(pointToRgb);
  const gradientCss =
    preferences.harmony === "floating"
      ? floatingGradient(colors, preferences.opacity, preferences.rotation)
      : layeredGradient(colors, preferences.opacity, preferences.rotation);
  const accent = ensureContrast(colors[0] ?? [128, 128, 128], isDark);

  return { colors, gradientCss, isDark, points, accent };
}

/** Proyecta el ambiente en la raíz: el fondo lo consume `.board-bg`. */
export function applyAmbientTheme(
  root: HTMLElement,
  theme: AmbientTheme,
  texture: number
): void {
  root.style.setProperty("--ambient-gradient", theme.gradientCss);
  root.style.setProperty("--ambient-texture", texture.toString());
}
