"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  type HarmonyType,
  type RGB,
  type WheelPoint,
  buildGradientCss,
  colorToWheelPosition,
  harmonize,
  hexToRgb,
  preferDarkText,
  rgbToHex,
  wheelPositionToColor
} from "@/lib/theme/color-harmony";

export type ColorScheme = "auto" | "light" | "dark";

export interface ThemeValue {
  scheme: ColorScheme;
  harmony: HarmonyType;
  /** Opacidad global del gradiente en [0,1]. */
  opacity: number;
  /** Posición del color primario en la rueda (círculo unitario). */
  primary: WheelPoint;
  /** Paleta resultante (primario + secundarios), RGB. */
  colors: RGB[];
  /** Cadena CSS lista para usar como `background`. */
  gradientCss: string;
}

export interface ThemePickerProps {
  value?: Partial<Pick<ThemeValue, "scheme" | "harmony" | "opacity" | "primary">>;
  onChange?: (value: ThemeValue) => void;
  /** Tamaño en px de la rueda. Por defecto 240. */
  size?: number;
}

const HARMONIES: { type: HarmonyType; label: string }[] = [
  { type: "complementary", label: "Complementario" },
  { type: "splitComplementary", label: "Dividido" },
  { type: "analogous", label: "Análogo" },
  { type: "triadic", label: "Triádico" },
  { type: "floating", label: "Libre" }
];

const SCHEMES: { value: ColorScheme; label: string; Icon: typeof Sun }[] = [
  { value: "auto", label: "Auto", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon }
];

const MIN_OPACITY = 0.25;
const MAX_OPACITY = 0.9;

const DEFAULT_PRIMARY: WheelPoint = colorToWheelPosition([218, 118, 130]);

function clampToCircle(point: WheelPoint): WheelPoint {
  const mag = Math.hypot(point.x, point.y);
  if (mag <= 1) return point;
  return { x: point.x / mag, y: point.y / mag };
}

/**
 * Panel de personalización de color portado de Zen Browser. Presentacional y
 * autocontenido: emite el tema resultante vía `onChange`. Engancha tú el valor a
 * tu store/persistencia y aplica `gradientCss` donde quieras.
 */
export function ThemePicker({ value, onChange, size = 240 }: ThemePickerProps) {
  const [scheme, setScheme] = useState<ColorScheme>(value?.scheme ?? "auto");
  const [harmony, setHarmony] = useState<HarmonyType>(value?.harmony ?? "analogous");
  const [opacity, setOpacity] = useState<number>(value?.opacity ?? 0.5);
  const [primary, setPrimary] = useState<WheelPoint>(value?.primary ?? DEFAULT_PRIMARY);

  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const radius = size / 2;

  // Paleta + gradiente derivados del estado actual.
  const { colors, points, gradientCss } = useMemo(() => {
    const pts = [primary, ...harmonize(primary, harmony)];
    const cols = pts.map((p) => wheelPositionToColor(p));
    const css = buildGradientCss(
      cols.map((rgb) => ({ rgb })),
      { opacity }
    );
    return { colors: cols, points: pts, gradientCss: css };
  }, [primary, harmony, opacity]);

  // Notifica al exterior en cada cambio.
  useEffect(() => {
    onChange?.({ scheme, harmony, opacity, primary, colors, gradientCss });
  }, [scheme, harmony, opacity, primary, colors, gradientCss, onChange]);

  const pointFromEvent = useCallback(
    (clientX: number, clientY: number): WheelPoint => {
      const rect = wheelRef.current?.getBoundingClientRect();
      if (!rect) return primary;
      const x = (clientX - rect.left - radius) / radius;
      const y = (clientY - rect.top - radius) / radius;
      return clampToCircle({ x, y });
    },
    [primary, radius]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setPrimary(pointFromEvent(event.clientX, event.clientY));
    },
    [pointFromEvent]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      setPrimary(pointFromEvent(event.clientX, event.clientY));
    },
    [pointFromEvent]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const primaryHex = useMemo(() => rgbToHex(colors[0] ?? [0, 0, 0]), [colors]);

  const previewDark = scheme === "dark" || (scheme === "auto" && !preferDarkText(colors[0] ?? [0, 0, 0]));

  return (
    <div className="theme-picker">
      <div className="theme-picker__schemes" role="group" aria-label="Esquema de color">
        {SCHEMES.map(({ value: s, label, Icon }) => (
          <button
            key={s}
            type="button"
            className={`theme-picker__scheme${scheme === s ? " is-active" : ""}`}
            onClick={() => setScheme(s)}
            aria-pressed={scheme === s}
            title={label}
          >
            <Icon size={15} strokeWidth={1.75} />
          </button>
        ))}
      </div>

      <div
        ref={wheelRef}
        className="theme-picker__wheel"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-label="Rueda de color"
        aria-valuetext={primaryHex}
        tabIndex={0}
      >
        {points.map((p, index) => (
          <span
            key={index}
            className={`theme-picker__dot${index === 0 ? " is-primary" : ""}`}
            style={{
              left: radius + p.x * radius,
              top: radius + p.y * radius,
              background: `rgb(${colors[index]?.join(", ")})`
            }}
          />
        ))}
      </div>

      <div className="theme-picker__harmonies" role="group" aria-label="Armonía">
        {HARMONIES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className={`theme-picker__harmony${harmony === type ? " is-active" : ""}`}
            onClick={() => setHarmony(type)}
            aria-pressed={harmony === type}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="theme-picker__opacity">
        <span>Opacidad</span>
        <input
          type="range"
          min={MIN_OPACITY}
          max={MAX_OPACITY}
          step={0.01}
          value={opacity}
          onChange={(event) => setOpacity(parseFloat(event.target.value))}
        />
      </label>

      <div className="theme-picker__footer">
        <label className="theme-picker__custom" title="Color personalizado">
          <input
            type="color"
            value={primaryHex}
            onChange={(event) => setPrimary(clampToCircle(colorToWheelPosition(hexToRgb(event.target.value))))}
          />
          <span>{primaryHex}</span>
        </label>
        <div
          className="theme-picker__preview"
          data-dark={previewDark}
          style={{ background: gradientCss }}
        >
          <span>Aa</span>
        </div>
      </div>
    </div>
  );
}

export default ThemePicker;
