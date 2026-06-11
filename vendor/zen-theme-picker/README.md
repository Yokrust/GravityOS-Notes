# Zen Theme Picker — Generador de gradientes / personalización de color

Este directorio contiene, **sin modificar**, el elemento de Zen Browser que permite
personalizar libremente los colores del navegador: elegir tonos, generar gradientes,
forzar modo claro / oscuro / automático, ajustar opacidad y mezclar colores
personalizados. Se guarda aquí como **referencia para una futura implementación** en
GravityOS-Notes.

> ⚠️ Estos archivos son una copia tal cual del repositorio de Zen Browser. No están
> integrados ni cableados a GravityOS-Notes. Sirven únicamente como material de
> referencia. Su licencia es **MPL 2.0** (ver cabeceras de cada archivo).

## Procedencia

- Repositorio: https://github.com/zen-browser/desktop
- Commit: `d5cbe55d2b16a599e59b2a25ae9df37270bb5bc4`
- Fecha del commit: 2026-06-10
- Extraído: 2026-06-10

## Qué es este elemento

En Zen, la personalización de color gira en torno a un **generador de gradientes**
(la clase `nsZenThemePicker` dentro de `ZenGradientGenerator.mjs`). El usuario coloca
"puntos" de color sobre una rueda/lienzo y el sistema genera una paleta armónica
(complementario, triádico, análogo, etc.) que se aplica a toda la UI mediante variables
CSS y un modificador de tema. Incluye:

- Selección de esquema: **auto / claro / oscuro**.
- Algoritmos de armonía de color (complementary, split, analogous, triadic, floating).
- Colores personalizados (`<input type="color">`) con opacidad por color.
- Control de opacidad global del gradiente y textura (grain).
- Sesgo de modo oscuro (`zen.theme.dark-mode-bias`).

## Archivos (estructura original de Zen conservada)

| Ruta | Rol |
|------|-----|
| `src/zen/spaces/ZenGradientGenerator.mjs` | **Lógica principal.** Clase `nsZenThemePicker`: armonía de color, parseo de sliders, generación de la cadena CSS del gradiente, persistencia. |
| `src/zen/spaces/zen-gradient-generator.css` | Estilos del panel/lienzo del generador. |
| `src/browser/base/content/zen-panels/theme-picker.inc` | **Markup (XUL/XHTML)** del panel `PanelUI-zen-gradient-generator`: esquema, paginación de presets, sliders y colores personalizados. |
| `src/zen/common/zenThemeModifier.js` | Aplica el tema generado a la UI (inyecta las variables de color resultantes). |
| `src/zen/common/styles/zen-theme.css` | Variables CSS del tema (acento, separación, radios, etc.). |
| `src/zen/common/modules/ZenCommonUtils.mjs` | Dependencia: `nsZenMultiWindowFeature` (sincroniza estado entre ventanas). Requerido por el `import` de `ZenGradientGenerator.mjs`. |
| `prefs/theme.yaml` | Preferencias del tema (`zen.theme.accent-color`, `zen.theme.dark-mode-bias`, `zen.theme.gradient.show-custom-colors`, etc.). |
| `locales/zen-theme-picker.en-US.ftl` | Cadenas de localización (Fluent) usadas por el panel. |

## Módulo ya portado (listo para usar)

La lógica reutilizable y agnóstica de plataforma ya está traducida a TypeScript puro en:

> `apps/desktop/src/renderer/lib/theme/color-harmony.ts`

Incluye conversión de color (HSL/RGB/hex), mezcla, luminancia/contraste WCAG,
armonías de color (`harmonize` / `harmonizeColors`), mapeo rueda↔color
(`wheelPositionToColor` / `colorToWheelPosition`) y generación del gradiente CSS
(`buildGradientCss`). Sin dependencias de Gecko ni del DOM; compila con el
`tsconfig.renderer.json` del proyecto.

## Componente React del panel (listo para usar)

> `apps/desktop/src/renderer/components/ThemePicker.tsx`
> (estilos en `apps/desktop/src/renderer/ui/app.css`, prefijo `.theme-picker`)

Panel presentacional y autocontenido construido sobre `color-harmony.ts`: rueda de
color interactiva (arrastrable), selector de esquema auto/claro/oscuro, selector de
armonía, slider de opacidad, color personalizado (`<input type="color">`) y vista
previa en vivo del gradiente. Emite el tema resultante por `onChange`:

```tsx
import { ThemePicker, type ThemeValue } from "@/components/ThemePicker";

<ThemePicker onChange={(t: ThemeValue) => {
  document.body.style.setProperty("--app-gradient", t.gradientCss);
}} />
```

Falta solo: enganchar `onChange` al store/persistencia del proyecto y aplicar
`gradientCss` (y, si quieres, `scheme`) a la superficie real de la app.

## Notas para una futura implementación

- El código es de Firefox/XUL: usa `ChromeUtils`, `XPCOMUtils`, `<panel>`/`<panelview>`
  y `data-l10n-id` (Fluent). Para portarlo a GravityOS-Notes (Electron + React) habría
  que **reescribir el markup XUL como componentes React** y reemplazar las APIs de
  preferencias de Gecko por el store/persistencia del proyecto.
- La parte verdaderamente reutilizable y agnóstica de plataforma es el **algoritmo de
  armonía de color y la generación de la cadena de gradiente** dentro de
  `ZenGradientGenerator.mjs`; lo demás (panel, prefs Gecko) es específico de Zen.
- Las preferencias clave a replicar: esquema claro/oscuro/auto, lista de colores con
  opacidad, opacidad global del gradiente y `dark-mode-bias`.
