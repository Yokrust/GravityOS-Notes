/**
 * color-harmony.ts
 *
 * Lógica de personalización de color extraída y portada del generador de
 * gradientes de Zen Browser (clase `nsZenThemePicker`). Reescrita como TypeScript
 * puro: sin dependencias de Gecko, XUL, `Services`, `ChromeUtils` ni del DOM.
 *
 * Modelo de la "rueda de color": un punto vive en un círculo unitario centrado en
 * (0,0) con radio 1. El ángulo respecto al centro define el TONO (hue); la distancia
 * al centro define saturación/luminosidad. Las armonías colocan puntos secundarios
 * sumando offsets de ángulo fijos al punto primario.
 *
 * Derivado de: github.com/zen-browser/desktop
 *   src/zen/spaces/ZenGradientGenerator.mjs (commit d5cbe55)
 * Licencia original: Mozilla Public License 2.0 (MPL-2.0).
 * Esta es una adaptación; conserva la atribución MPL-2.0.
 */

export type RGB = [number, number, number];

/** Punto en el círculo unitario de la rueda de color. |(x,y)| ∈ [0, 1]. */
export interface WheelPoint {
  x: number;
  y: number;
}

export type HarmonyType =
  | "complementary"
  | "singleAnalogous"
  | "splitComplementary"
  | "analogous"
  | "triadic"
  | "floating";

export interface Harmony {
  type: HarmonyType;
  /** Offsets de ángulo (grados) aplicados al punto primario para cada secundario. */
  angles: number[];
}

/**
 * Tabla de armonías de color. Cada `angles[i]` es el desfase en grados del punto
 * secundario i respecto al primario sobre la rueda. Portado tal cual de
 * `get colorHarmonies()`.
 */
export const COLOR_HARMONIES: readonly Harmony[] = [
  { type: "complementary", angles: [180] },
  { type: "singleAnalogous", angles: [310] },
  { type: "splitComplementary", angles: [150, 210] },
  { type: "analogous", angles: [50, 310] },
  { type: "triadic", angles: [120, 240] },
  { type: "floating", angles: [] }
];

// ---------------------------------------------------------------------------
// Conversión de espacios de color (funciones puras)
// ---------------------------------------------------------------------------

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/**
 * HSL → RGB. `h` en [0,1], `s`/`l` en [0,1]. Devuelve enteros [0,255].
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const { round } = Math;
  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l; // acromático
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [round(r * 255), round(g * 255), round(b * 255)];
}

/**
 * RGB → HSL. Entrada [0,255]. Devuelve `[hueDeg (0..360), s (0..1), l (0..1)]`.
 */
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
  const d = max - min;
  let h = 0;
  if (d === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  const l = (min + max) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h * 60, s, l];
}

/** Hex (`#rgb` o `#rrggbb`) → RGB. */
export function hexToRgb(hex: string): RGB {
  if (hex.startsWith("#")) hex = hex.substring(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
}

/** RGB → hex `#rrggbb`. Útil para `<input type="color">`. */
export function rgbToHex([r, g, b]: RGB): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mezcla lineal de dos colores. `percentage` = peso de `rgb1` en [0,100]. */
export function blendColors(rgb1: RGB, rgb2: RGB, percentage: number): RGB {
  const p = percentage / 100;
  return [
    Math.round(rgb1[0] * p + rgb2[0] * (1 - p)),
    Math.round(rgb1[1] * p + rgb2[1] * (1 - p)),
    Math.round(rgb1[2] * p + rgb2[2] * (1 - p))
  ];
}

// ---------------------------------------------------------------------------
// Luminancia y contraste (WCAG)
// ---------------------------------------------------------------------------

/** Luminancia relativa WCAG. Entrada RGB [0,255]. */
export function relativeLuminance([r, g, b]: RGB): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
}

/** Ratio de contraste WCAG entre dos colores (1..21). */
export function contrastRatio(rgb1: RGB, rgb2: RGB): number {
  const lum1 = relativeLuminance(rgb1);
  const lum2 = relativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

/**
 * Decide si sobre `background` conviene texto oscuro (true) o claro (false),
 * comparando contraste contra negro vs blanco. Versión simplificada y agnóstica
 * de `shouldBeDarkMode` (sin prefs de Gecko ni bias de plataforma).
 */
export function preferDarkText(background: RGB): boolean {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE);
}

// ---------------------------------------------------------------------------
// Mapeo posición de la rueda ↔ color
// ---------------------------------------------------------------------------

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function angleDegOf(p: WheelPoint): number {
  const a = Math.atan2(p.y, p.x) * DEG;
  return (a + 360) % 360;
}

function magnitudeOf(p: WheelPoint): number {
  return Math.min(1, Math.hypot(p.x, p.y));
}

export type WheelColorMode =
  | { mode: "auto" } // saturación alta fija; la distancia controla la luminosidad
  | { mode: "fixed-lightness"; lightness: number } // distancia controla saturación
  | { mode: "grayscale" }; // de blanco (borde) a negro (centro)

/**
 * Color en una posición de la rueda. Portado de `getColorFromPosition`, pero sobre
 * el círculo unitario (centro 0,0, radio 1) en vez de coordenadas del DOM.
 *
 * - centro  → luminosidad baja (oscuro)
 * - borde   → luminosidad alta (claro)
 * - ángulo  → tono
 */
export function wheelPositionToColor(
  point: WheelPoint,
  opts: WheelColorMode = { mode: "auto" }
): RGB {
  const distance = magnitudeOf(point);
  const normalizedDistance = 1 - distance; // 1 en el centro, 0 en el borde
  const hue = angleDegOf(point);

  let saturation: number;
  let lightness: number;

  switch (opts.mode) {
    case "grayscale":
      saturation = 0;
      lightness = Math.round((1 - normalizedDistance) * 100);
      break;
    case "fixed-lightness":
      saturation = normalizedDistance * 100;
      lightness = opts.lightness;
      break;
    case "auto":
    default:
      saturation = 90 + (1 - normalizedDistance) * 10;
      lightness = Math.round((1 - normalizedDistance) * 100);
      break;
  }

  const [r, g, b] = hslToRgb(hue / 360, saturation / 100, lightness / 100);
  return [
    Math.min(255, Math.max(0, r)),
    Math.min(255, Math.max(0, g)),
    Math.min(255, Math.max(0, b))
  ];
}

/**
 * Posición en la rueda de un color dado. Inverso aproximado de
 * `wheelPositionToColor`. Portado de `calculateInitialPosition`: tono → ángulo,
 * saturación → radio.
 */
export function colorToWheelPosition(rgb: RGB): WheelPoint {
  const [hue, saturation] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const angle = hue * RAD;
  return {
    x: saturation * Math.cos(angle),
    y: saturation * Math.sin(angle)
  };
}

// ---------------------------------------------------------------------------
// Armonía de color: corazón del generador
// ---------------------------------------------------------------------------

/**
 * Dado el punto primario en la rueda y un tipo de armonía, devuelve las posiciones
 * de los puntos secundarios (los "compliments"). Misma distancia al centro que el
 * primario, ángulos desplazados según la tabla de armonías.
 *
 * Esencia portada de `calculateCompliments` (sin la selección incremental
 * añadir/quitar punto, que dependía de la UI).
 */
export function harmonize(
  primary: WheelPoint,
  type: HarmonyType
): WheelPoint[] {
  const harmony = COLOR_HARMONIES.find((h) => h.type === type);
  if (!harmony || harmony.angles.length === 0) return [];

  const baseAngle = angleDegOf(primary);
  const distance = magnitudeOf(primary);

  return harmony.angles.map((offset) => {
    const angle = (baseAngle + offset) % 360;
    const radian = angle * RAD;
    return {
      x: distance * Math.cos(radian),
      y: distance * Math.sin(radian)
    };
  });
}

/**
 * Genera la paleta completa (primario + secundarios) como colores RGB para un tipo
 * de armonía. Conveniencia que combina `harmonize` + `wheelPositionToColor`.
 */
export function harmonizeColors(
  primary: WheelPoint,
  type: HarmonyType,
  mode: WheelColorMode = { mode: "auto" }
): RGB[] {
  const points = [primary, ...harmonize(primary, type)];
  return points.map((p) => wheelPositionToColor(p, mode));
}

// ---------------------------------------------------------------------------
// Generación de la cadena de gradiente CSS
// ---------------------------------------------------------------------------

export interface GradientColor {
  rgb: RGB;
  /** Opacidad del color en [0,1]. Por defecto la opacidad global. */
  opacity?: number;
}

export interface GradientOptions {
  /** Opacidad global por defecto en [0,1]. */
  opacity?: number;
  /** Ángulo del gradiente lineal en grados. Zen usa -45. */
  rotation?: number;
}

function rgba([r, g, b]: RGB, opacity: number): string {
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Construye el `background` CSS a partir de 0..3 colores. Portado de la rama
 * no-toolbar de `getGradient`:
 *   - 1 color  → sólido
 *   - 2 colores → dos `linear-gradient` superpuestos
 *   - 3 colores → `linear-gradient` + dos `radial-gradient`
 * Con 0 colores devuelve `fallback`.
 */
export function buildGradientCss(
  colors: GradientColor[],
  opts: GradientOptions = {},
  fallback = "transparent"
): string {
  const opacity = opts.opacity ?? 0.5;
  const rotation = opts.rotation ?? -45;
  const single = (c: GradientColor) => rgba(c.rgb, c.opacity ?? opacity);

  const [c0, c1, c2] = colors;

  if (!c0) return fallback;
  if (colors.length === 1) return single(c0);

  if (colors.length === 2 || !c2) {
    return [
      `linear-gradient(${rotation}deg, ${single(c1!)} 0%, transparent 100%)`,
      `linear-gradient(${rotation + 180}deg, ${single(c0)} 0%, transparent 100%)`
    ]
      .reverse()
      .join(", ");
  }

  // 3 o más: usamos los tres primeros como en Zen.
  const color1 = single(c2);
  const color2 = single(c0);
  const color3 = single(c1!);
  return [
    `linear-gradient(-5deg, ${color1} 10%, transparent 80%)`,
    `radial-gradient(circle at 95% 0%, ${color3} 0%, transparent 75%)`,
    `radial-gradient(circle at 0% 0%, ${color2} 10%, transparent 70%)`
  ].join(", ");
}
