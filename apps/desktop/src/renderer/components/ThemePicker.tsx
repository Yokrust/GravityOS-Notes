"use client";

import { useMemo, useRef, useState } from "react";
import { Monitor, Moon, Plus, Sun, Trash2 } from "lucide-react";

import {
  buildAmbientTheme,
  pointToRgb,
  resolveAmbientPoints,
  rgbToHex,
  rgbToPoint,
  type Rgb
} from "../lib/ambient.js";

const HARMONY_OPTIONS: Array<{
  type: AppearanceHarmonyRecord;
  label: string;
}> = [
  { type: "complementary", label: "Complementario" },
  { type: "singleAnalogous", label: "Sencillo" },
  { type: "splitComplementary", label: "Dividido" },
  { type: "analogous", label: "Análogo" },
  { type: "triadic", label: "Triádico" },
  { type: "floating", label: "Libre" }
];

const SCHEME_OPTIONS: Array<{
  value: AppearanceSchemeRecord;
  label: string;
  Icon: typeof Monitor;
}> = [
  { value: "auto", label: "Auto", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon }
];

export function ThemePicker({
  onChange,
  onCommit,
  onSchemeSelect,
  size = 250,
  value
}: {
  onChange: (preferences: AppearancePreferencesRecord) => void;
  onCommit: (preferences: AppearancePreferencesRecord) => void;
  onSchemeSelect?: (scheme: AppearanceSchemeRecord) => void;
  size?: number;
  value: AppearancePreferencesRecord;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const latestRef = useRef(value);
  latestRef.current = value;

  const radius = size / 2;
  const points = useMemo(() => resolveAmbientPoints(value), [value]);
  const colors = useMemo(() => points.map(pointToRgb), [points]);
  const activeIndex =
    value.harmony === "floating"
      ? Math.min(selectedIndex, value.points.length - 1)
      : 0;
  activeIndexRef.current = activeIndex;
  const activeColor = colors[activeIndex] ?? colors[0] ?? ([0, 0, 0] as Rgb);
  const activeHex = rgbToHex(activeColor);
  const ambient = buildAmbientTheme(
    value,
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  function update(next: AppearancePreferencesRecord, commit = false) {
    latestRef.current = next;
    onChange(next);
    if (commit) onCommit(next);
  }

  function movePoint(point: AppearanceGradientPointRecord) {
    const index = value.harmony === "floating" ? activeIndexRef.current : 0;
    const nextPoints = [...value.points];
    nextPoints[index] = clampPoint(point);
    update({ ...value, points: nextPoints });
  }

  function pointFromEvent(clientX: number, clientY: number) {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return value.points[activeIndex] ?? value.points[0];
    return clampPoint({
      x: (clientX - rect.left - radius) / radius,
      y: (clientY - rect.top - radius) / radius
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event.clientX, event.clientY);
    if (!point) return;

    if (value.harmony === "floating") {
      const nearest = nearestPointIndex(value.points, point);
      activeIndexRef.current = nearest;
      setSelectedIndex(nearest);
      const nextPoints = [...value.points];
      nextPoints[nearest] = point;
      update({ ...value, points: nextPoints });
      return;
    }
    movePoint(point);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const point = pointFromEvent(event.clientX, event.clientY);
    if (point) movePoint(point);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(latestRef.current);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.08 : 0.025;
    const current = {
      ...(value.points[activeIndex] ?? value.points[0] ?? { x: 0, y: 0 })
    };
    if (event.key === "ArrowLeft") current.x -= step;
    else if (event.key === "ArrowRight") current.x += step;
    else if (event.key === "ArrowUp") current.y -= step;
    else if (event.key === "ArrowDown") current.y += step;
    else return;
    event.preventDefault();
    movePoint(current);
  }

  function addColor() {
    if (value.points.length >= 5) return;
    const last = value.points.at(-1) ?? value.points[0] ?? { x: 0.4, y: 0 };
    const angle = Math.atan2(last.y, last.x) + (Math.PI * 2) / 5;
    const distance = Math.max(0.36, Math.hypot(last.x, last.y));
    const point = {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
    const next: AppearancePreferencesRecord = {
      ...value,
      harmony: "floating",
      points: [...value.points, point]
    };
    activeIndexRef.current = next.points.length - 1;
    setSelectedIndex(next.points.length - 1);
    update(next, true);
  }

  function removeColor() {
    if (value.points.length <= 1) return;
    const nextPoints = value.points.filter((_, index) => index !== activeIndex);
    const next = { ...value, points: nextPoints };
    activeIndexRef.current = Math.max(0, activeIndex - 1);
    setSelectedIndex(Math.max(0, activeIndex - 1));
    update(next, true);
  }

  return (
    <div className="theme-picker">
      <div className="theme-picker__toolbar">
        <div
          aria-label="Esquema de color"
          className="theme-picker__schemes"
          role="group"
        >
          {SCHEME_OPTIONS.map(({ value: scheme, label, Icon }) => (
            <button
              aria-label={label}
              aria-pressed={value.scheme === scheme}
              className={`theme-picker__scheme ${
                value.scheme === scheme ? "is-active" : ""
              }`}
              key={scheme}
              onClick={() => {
                update({ ...value, scheme }, true);
                onSchemeSelect?.(scheme);
              }}
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
            onKeyDown={handleKeyDown}
            onKeyUp={() => onCommit(latestRef.current)}
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
                  index === activeIndex ? "is-primary" : ""
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
              {HARMONY_OPTIONS.map(({ type, label }) => (
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
                        : [value.points[0] ?? { x: 0.56, y: -0.32 }];
                    activeIndexRef.current = 0;
                    setSelectedIndex(0);
                    update(
                      { ...value, harmony: type, points: nextPoints },
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
                    onClick={removeColor}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    aria-label="Añadir color"
                    disabled={value.points.length >= 5}
                    onClick={addColor}
                    type="button"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <div className="theme-picker__color-list">
                {value.points.map((point, index) => {
                  const rgb = pointToRgb(point);
                  return (
                    <button
                      aria-label={`Editar color ${index + 1}`}
                      aria-pressed={index === activeIndex}
                      key={`${point.x}-${point.y}`}
                      onClick={() => {
                        activeIndexRef.current = index;
                        setSelectedIndex(index);
                      }}
                      style={{ background: rgbToHex(rgb) }}
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
                  movePoint(rgbToPoint(hexToRgb(event.target.value)));
                  queueMicrotask(() => onCommit(latestRef.current));
                }}
                type="color"
                value={activeHex}
              />
              <code>{activeHex}</code>
            </span>
          </label>

          <RangeControl
            label="Opacidad"
            max={1}
            min={0.2}
            onChange={(opacity) => update({ ...value, opacity })}
            onCommit={() => onCommit(latestRef.current)}
            step={0.01}
            value={value.opacity}
          />
          <RangeControl
            label="Textura"
            max={0.45}
            min={0}
            onChange={(texture) => update({ ...value, texture })}
            onCommit={() => onCommit(latestRef.current)}
            step={0.01}
            value={value.texture}
          />
          <RangeControl
            label="Ángulo"
            max={180}
            min={-180}
            onChange={(rotation) => update({ ...value, rotation })}
            onCommit={() => onCommit(latestRef.current)}
            step={1}
            suffix="°"
            value={value.rotation}
          />
        </div>
      </div>

      <div
        className="theme-picker__preview"
        data-dark={ambient.isDark}
        style={{ background: `${ambient.gradientCss}, var(--bg)` }}
      >
        <span>Gravity</span>
        <small>Vista previa del ambiente</small>
      </div>
    </div>
  );
}

function RangeControl({
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
  const display = Math.round(suffix === "%" ? value * 100 : value);
  return (
    <label className="theme-picker__range">
      <span>
        <span className="theme-picker__control-label">{label}</span>
        <output>
          {display}
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

function clampPoint(
  point: AppearanceGradientPointRecord
): AppearanceGradientPointRecord {
  const magnitude = Math.hypot(point.x, point.y);
  return magnitude <= 1
    ? point
    : { x: point.x / magnitude, y: point.y / magnitude };
}

function nearestPointIndex(
  points: AppearanceGradientPointRecord[],
  target: AppearanceGradientPointRecord
): number {
  let nearest = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
}
