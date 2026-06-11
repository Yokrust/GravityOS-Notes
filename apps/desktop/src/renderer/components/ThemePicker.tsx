import type {
  AppearanceColorScheme,
  AppearancePreferences,
  ThemeHarmony,
  ThemePoint
} from "@gravity/application";
import { Minus, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  colorToWheelPosition,
  rgbToHex,
  wheelPositionToColor
} from "../lib/theme/color-harmony.js";
import {
  resolveThemePoints,
  resolveThemePresentation
} from "../lib/theme/appearance.js";

export interface ThemePickerProps {
  onChange: (value: AppearancePreferences) => void;
  onCommit: (value: AppearancePreferences) => void;
  size?: number;
  value: AppearancePreferences;
}

const HARMONIES: Array<{ type: ThemeHarmony; label: string }> = [
  { type: "complementary", label: "Complementario" },
  { type: "splitComplementary", label: "Dividido" },
  { type: "analogous", label: "Análogo" },
  { type: "triadic", label: "Triádico" },
  { type: "floating", label: "Libre" }
];

const SCHEMES: Array<{
  value: AppearanceColorScheme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "auto", label: "Auto", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon }
];

export function ThemePicker({
  onChange,
  onCommit,
  size = 250,
  value
}: ThemePickerProps) {
  const [selectedPoint, setSelectedPoint] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const draggedPoint = useRef(0);
  const draft = useRef(value);
  draft.current = value;

  const radius = size / 2;
  const points = useMemo(() => resolveThemePoints(value), [value]);
  const colors = useMemo(
    () => points.map((point) => wheelPositionToColor(point)),
    [points]
  );
  const activePointIndex =
    value.harmony === "floating"
      ? Math.min(selectedPoint, value.points.length - 1)
      : 0;
  draggedPoint.current = activePointIndex;
  const activeColor = colors[activePointIndex] ?? colors[0] ?? [0, 0, 0];
  const activeHex = rgbToHex(activeColor);
  const preview = resolveThemePresentation(
    value,
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  function emit(next: AppearancePreferences, commit = false) {
    draft.current = next;
    onChange(next);
    if (commit) {
      onCommit(next);
    }
  }

  function updatePoint(point: ThemePoint) {
    const pointIndex = value.harmony === "floating" ? draggedPoint.current : 0;
    const nextPoints = [...value.points];
    nextPoints[pointIndex] = clampToCircle(point);
    emit({
      ...value,
      points: nextPoints
    });
  }

  function pointFromEvent(clientX: number, clientY: number): ThemePoint {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) {
      return value.points[activePointIndex] ?? value.points[0]!;
    }
    return clampToCircle({
      x: (clientX - rect.left - radius) / radius,
      y: (clientY - rect.top - radius) / radius
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event.clientX, event.clientY);

    if (value.harmony === "floating") {
      const nearestIndex = findNearestPoint(value.points, point);
      draggedPoint.current = nearestIndex;
      setSelectedPoint(nearestIndex);
      const nextPoints = [...value.points];
      nextPoints[nearestIndex] = point;
      emit({ ...value, points: nextPoints });
      return;
    }

    updatePoint(point);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) {
      return;
    }
    updatePoint(pointFromEvent(event.clientX, event.clientY));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(draft.current);
  }

  function handleWheelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.shiftKey ? 0.08 : 0.025;
    const current = value.points[activePointIndex] ?? value.points[0]!;
    const next = { ...current };

    if (event.key === "ArrowLeft") next.x -= delta;
    else if (event.key === "ArrowRight") next.x += delta;
    else if (event.key === "ArrowUp") next.y -= delta;
    else if (event.key === "ArrowDown") next.y += delta;
    else return;

    event.preventDefault();
    updatePoint(next);
  }

  function addFreePoint() {
    if (value.points.length >= 5) {
      return;
    }
    const source = value.points.at(-1) ?? value.points[0]!;
    const angle = Math.atan2(source.y, source.x) + (Math.PI * 2) / 5;
    const magnitude = Math.max(0.36, Math.hypot(source.x, source.y));
    const nextPoint = {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude
    };
    const next = {
      ...value,
      harmony: "floating" as const,
      points: [...value.points, nextPoint]
    };
    draggedPoint.current = next.points.length - 1;
    setSelectedPoint(next.points.length - 1);
    emit(next, true);
  }

  function removeFreePoint() {
    if (value.points.length <= 1) {
      return;
    }
    const nextPoints = value.points.filter(
      (_, index) => index !== activePointIndex
    );
    const next = { ...value, points: nextPoints };
    draggedPoint.current = Math.max(0, activePointIndex - 1);
    setSelectedPoint(Math.max(0, activePointIndex - 1));
    emit(next, true);
  }

  return (
    <div className="theme-picker">
      <div className="theme-picker__toolbar">
        <div
          aria-label="Esquema de color"
          className="theme-picker__schemes"
          role="group"
        >
          {SCHEMES.map(({ value: scheme, label, Icon }) => (
            <button
              aria-label={label}
              aria-pressed={value.scheme === scheme}
              className={`theme-picker__scheme ${
                value.scheme === scheme ? "is-active" : ""
              }`}
              key={scheme}
              onClick={() =>
                emit(
                  {
                    ...value,
                    scheme
                  },
                  true
                )
              }
              title={label}
              type="button"
            >
              <Icon size={15} strokeWidth={1.75} />
            </button>
          ))}
        </div>
        <span className="theme-picker__mode-label">
          {value.harmony === "floating"
            ? `${value.points.length} colores`
            : "Paleta automática"}
        </span>
      </div>

      <div className="theme-picker__workspace">
        <div>
          <div
            aria-label="Rueda de color"
            aria-valuetext={activeHex}
            className="theme-picker__wheel"
            onKeyDown={handleWheelKeyDown}
            onKeyUp={() => onCommit(draft.current)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={wheelRef}
            role="slider"
            style={{ height: size, width: size }}
            tabIndex={0}
          >
            {points.map((point, index) => (
              <span
                className={`theme-picker__dot ${
                  index === activePointIndex ? "is-primary" : ""
                }`}
                key={`${index}-${point.x}-${point.y}`}
                style={{
                  background: `rgb(${colors[index]?.join(", ")})`,
                  left: radius + point.x * radius,
                  top: radius + point.y * radius
                }}
              />
            ))}
          </div>
          <p className="theme-picker__hint">
            Arrastra un punto. En Libre, selecciona y mueve cada color.
          </p>
        </div>

        <div className="theme-picker__controls">
          <div>
            <span className="theme-picker__control-label">Armonía</span>
            <div
              aria-label="Armonía"
              className="theme-picker__harmonies"
              role="group"
            >
              {HARMONIES.map(({ type, label }) => (
                <button
                  aria-pressed={value.harmony === type}
                  className={`theme-picker__harmony ${
                    value.harmony === type ? "is-active" : ""
                  }`}
                  key={type}
                  onClick={() => {
                    const nextPoints =
                      type === "floating"
                        ? points.slice(0, 3)
                        : [value.points[0]!];
                    draggedPoint.current = 0;
                    setSelectedPoint(0);
                    emit(
                      {
                        ...value,
                        harmony: type,
                        points: nextPoints
                      },
                      true
                    );
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {value.harmony === "floating" ? (
            <div>
              <div className="theme-picker__color-heading">
                <span className="theme-picker__control-label">Colores</span>
                <div>
                  <button
                    aria-label="Quitar color"
                    disabled={value.points.length <= 1}
                    onClick={removeFreePoint}
                    type="button"
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    aria-label="Añadir color"
                    disabled={value.points.length >= 5}
                    onClick={addFreePoint}
                    type="button"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <div className="theme-picker__color-list">
                {value.points.map((point, index) => {
                  const color = wheelPositionToColor(point);
                  return (
                    <button
                      aria-label={`Editar color ${index + 1}`}
                      aria-pressed={index === activePointIndex}
                      key={`${point.x}-${point.y}`}
                      onClick={() => {
                        draggedPoint.current = index;
                        setSelectedPoint(index);
                      }}
                      style={{ background: rgbToHex(color) }}
                      type="button"
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="theme-picker__custom">
            <span className="theme-picker__control-label">Color activo</span>
            <span>
              <input
                aria-label="Color personalizado"
                onChange={(event) => {
                  const point = clampToCircle(
                    colorToWheelPosition(hexToRgbSafe(event.target.value))
                  );
                  updatePoint(point);
                  queueMicrotask(() => onCommit(draft.current));
                }}
                type="color"
                value={activeHex}
              />
              <code>{activeHex}</code>
            </span>
          </label>

          <ThemeRange
            label="Opacidad"
            max={1}
            min={0.2}
            onChange={(opacity) => emit({ ...value, opacity })}
            onCommit={() => onCommit(draft.current)}
            step={0.01}
            value={value.opacity}
          />
          <ThemeRange
            label="Textura"
            max={0.45}
            min={0}
            onChange={(texture) => emit({ ...value, texture })}
            onCommit={() => onCommit(draft.current)}
            step={0.01}
            value={value.texture}
          />
          <ThemeRange
            label="Ángulo"
            max={180}
            min={-180}
            onChange={(rotation) => emit({ ...value, rotation })}
            onCommit={() => onCommit(draft.current)}
            step={1}
            suffix="°"
            value={value.rotation}
          />
        </div>
      </div>

      <div
        className="theme-picker__preview"
        data-dark={preview.isDark}
        style={{ background: `${preview.gradientCss}, var(--bg)` }}
      >
        <span>Gravity</span>
        <small>Vista previa del tema</small>
      </div>
    </div>
  );
}

function ThemeRange({
  label,
  max,
  min,
  onChange,
  onCommit,
  step,
  suffix = "%",
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  step: number;
  suffix?: string;
  value: number;
}) {
  const displayValue =
    suffix === "%" ? Math.round(value * 100) : Math.round(value);

  return (
    <label className="theme-picker__range">
      <span>
        <span className="theme-picker__control-label">{label}</span>
        <output>
          {displayValue}
          {suffix}
        </output>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        onKeyUp={onCommit}
        onPointerUp={onCommit}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function clampToCircle(point: ThemePoint): ThemePoint {
  const magnitude = Math.hypot(point.x, point.y);
  if (magnitude <= 1) {
    return point;
  }
  return {
    x: point.x / magnitude,
    y: point.y / magnitude
  };
}

function findNearestPoint(points: ThemePoint[], target: ThemePoint): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function hexToRgbSafe(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
