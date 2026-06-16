"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pipette, SwatchBook } from "lucide-react";

import { ACCENTS, THEMES, useAppearance } from "../lib/appearance.js";
import { hslToRgb, rgbToHex, rgbToHsl } from "../lib/ambient.js";
import { t } from "../lib/i18n.js";

/** El selector nativo da/recibe hex; el acento conserva matiz, saturación y
 *  luminosidad para reproducir exactamente el color elegido. */
function customAccentHex(h: number, s: number, l: number): string {
  return rgbToHex(hslToRgb(h / 360, s / 100, l / 100));
}

function hexToCustomAccent(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace("#", "");
  const rgb: [number, number, number] = [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return {
    h: Math.round(((h % 360) + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function AppearanceMenu() {
  const { accent, customAccent, setAccent, setCustomAccent, setTheme, theme } =
    useAppearance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={t("Apariencia")}
        className="appearance-trigger"
        data-open={open}
        onClick={() => setOpen((value) => !value)}
        title={t("Apariencia")}
        type="button"
      >
        <SwatchBook size={14} strokeWidth={1.8} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass-strong appearance-panel"
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="appearance-kicker">{t("Tema")}</p>
            <div className="appearance-themes" role="radiogroup">
              {THEMES.map((option, index) => (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  aria-checked={theme === option.id}
                  className={`appearance-theme ${
                    theme === option.id ? "is-selected" : ""
                  }`}
                  initial={{ opacity: 0, y: 6 }}
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  role="radio"
                  transition={{
                    delay: 0.04 + index * 0.05,
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  type="button"
                >
                  {/* data-theme en el swatch re-evalúa los tokens y dibuja la
                      mini-ventana con la paleta real de cada tema */}
                  <span className="appearance-swatch" data-theme={option.id} />
                  <span className="appearance-theme-name">
                    {t(option.label)}
                  </span>
                </motion.button>
              ))}
            </div>

            <p className="appearance-kicker">{t("Acento")}</p>
            <div className="appearance-accents" role="radiogroup">
              {ACCENTS.map((option) => (
                <button
                  aria-checked={accent === option.id}
                  aria-label={t(option.label)}
                  className={`appearance-accent ${
                    accent === option.id ? "is-selected" : ""
                  }`}
                  key={option.id}
                  onClick={() => setAccent(option.id)}
                  role="radio"
                  style={
                    {
                      "--swatch-h": option.h,
                      "--swatch-s": option.s
                    } as React.CSSProperties
                  }
                  title={t(option.label)}
                  type="button"
                />
              ))}

              {/* Acento libre: el swatch envuelve un input de color nativo */}
              <label
                aria-label={t("Acento personalizado")}
                className={`appearance-accent appearance-accent-custom ${
                  accent === "custom" ? "is-selected" : ""
                }`}
                style={
                  {
                    "--swatch-h": customAccent.h,
                    "--swatch-s": `${customAccent.s}%`,
                    "--swatch-l": `${customAccent.l}%`
                  } as React.CSSProperties
                }
                title={t("Acento personalizado")}
              >
                <Pipette size={11} strokeWidth={2} />
                <input
                  aria-label={t("Elegir color de acento")}
                  className="appearance-accent-input"
                  onChange={(event) =>
                    setCustomAccent(hexToCustomAccent(event.target.value))
                  }
                  type="color"
                  value={customAccentHex(
                    customAccent.h,
                    customAccent.s,
                    customAccent.l
                  )}
                />
              </label>
            </div>

            <p className="appearance-footnote">
              {t(
                "Cristal y Cristal Noche recrean el vidrio líquido de Apple en día y noche: superficies translúcidas sobre una malla de color viva."
              )}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
