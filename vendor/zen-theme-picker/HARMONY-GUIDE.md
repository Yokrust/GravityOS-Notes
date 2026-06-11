# Guía de la lógica reutilizable — `ZenGradientGenerator.mjs`

Mapa de las funciones dentro de
[`src/zen/spaces/ZenGradientGenerator.mjs`](src/zen/spaces/ZenGradientGenerator.mjs),
clasificadas por cuánto sirven para portar a GravityOS-Notes (Electron + React).

Leyenda:
- 🟢 **Puro / agnóstico** — matemáticas o strings sin dependencia de Gecko/DOM. Copiar casi tal cual.
- 🟡 **Reutilizable con ajustes** — lógica buena, pero lee tamaños del DOM o estado de la clase.
- 🔴 **Específico de Zen/Gecko** — `Services`, `ChromeUtils`, XUL, workspaces. Reescribir desde cero.

---

## 1. Núcleo de armonía de color  🟢🟡

Esto es **el corazón** de lo que pediste: a partir de un color "primario" coloca el
resto de puntos en ángulos fijos sobre la rueda para formar la paleta.

| Línea | Símbolo | Qué hace | Reuso |
|------:|---------|----------|:-----:|
| `196` | `get colorHarmonies()` | **Tabla de armonías.** Define los offsets de ángulo por tipo: complementary `[180]`, singleAnalogous `[310]`, splitComplementary `[150,210]`, analogous `[50,310]`, triadic `[120,240]`, floating `[]`. | 🟢 |
| `766` | `calculateCompliments(dots, action, useHarmony)` | Dado el punto primario, calcula la posición de los puntos secundarios aplicando los ángulos de la armonía elegida. Contiene los helpers internos `getAngleFromPosition` y `getDistanceFromCenter` (trigonometría pura, líneas `820`–`831`). | 🟡 |

> El algoritmo real son ~15 líneas (`874`–`888`): convierte el punto primario a
> ángulo+distancia respecto al centro, suma cada `angleOffset` de la armonía y
> reproyecta a coordenadas. Todo lo demás de la función es selección de armonía según
> añadir/quitar puntos. La parte 🟡 es solo que lee `rect.width/height` del panel para
> el centro y el radio — trivial de sustituir por las dimensiones de tu lienzo.

---

## 2. Conversión de espacios de color  🟢

Funciones puras, copiar literal:

| Línea | Símbolo | Qué hace |
|------:|---------|----------|
| `452` | `hslToRgb(h, s, l)` | HSL → RGB |
| `469` | `rgbToHsl(r, g, b)` | RGB → HSL |
| `491` | `hueToRgb(p, q, t)` | Helper de `hslToRgb` |
| `1452` | `hexToRgb(hex)` | Hex (`#rgb`/`#rrggbb`) → RGB |
| `1324` | `blendColors(rgb1, rgb2, percentage)` | Mezcla lineal de dos RGB |
| `1256` | `blendWithWhiteOverlay(baseColor, opacity)` | Simula opacidad sobre fondo blanco |

---

## 3. Mapeo posición ↔ color (rueda de color)  🟡

La UI es un círculo: el ángulo del cursor define el **tono**, la distancia al centro
define **saturación/luminosidad**. Math pura, pero atada a las dimensiones del lienzo.

| Línea | Símbolo | Qué hace |
|------:|---------|----------|
| `531` | `getColorFromPosition(x, y, type)` | Posición (x,y) → color HSL→RGB. Soporta modos `explicit-lightness` y `explicit-black-white` (escala de grises). |
| `510` | `calculateInitialPosition([r,g,b])` | Inverso: dado un RGB, dónde cae el punto en la rueda (usa `rgbToHsl`). |

> Para portar: sustituye los `rect`/`padding`/`dotHalfSize` hardcodeados por los de tu
> componente. La fórmula (ángulo→hue, distancia→saturación/lightness) se mantiene igual.

---

## 4. Generación del gradiente CSS  🟡

| Línea | Símbolo | Qué hace |
|------:|---------|----------|
| `1333` | `getGradient(colors, forToolbar)` | **Produce la cadena CSS final.** 1 color → sólido; 2 → dos `linear-gradient` superpuestos; 3 → combinación de `linear` + dos `radial-gradient`; colores custom → `linear-gradient` repartido uniformemente. |
| `1281` | `#getSingleRGBColor(color, forToolbar)` (privada) | Resuelve un color individual aplicando opacidad. |
| `1218` | `themedColors(colors)` | Normaliza la lista de colores antes de generar. |

> 🟡 solo porque consulta `this.isDarkMode` / `this.currentOpacity`. La estructura de
> los `linear/radial-gradient` es CSS estándar y funciona igual en Electron.

---

## 5. Decisión claro/oscuro y contraste  🟢🟡

| Línea | Símbolo | Qué hace | Reuso |
|------:|---------|----------|:-----:|
| `1306` | `luminance([r,g,b])` | Luminancia relativa (WCAG) | 🟢 |
| `1316` | `contrastRatio(rgb1, rgb2)` | Ratio de contraste WCAG | 🟢 |
| `1389` | `shouldBeDarkMode(accentColor)` | Decide si el acento pide texto claro u oscuro comparando contraste; aplica `darkModeBias`. | 🟡 (lee prefs) |

---

## 6. Glue específico de Zen — **no portar, reescribir**  🔴

`constructor`, `init*` (`initPredefinedColors` 236, `initColorPages` 283,
`initSchemeButtons` 316, `initCustomColorInput` 229), `openThemePicker` 216,
`initContextMenu` 207, manejo de arrastre de puntos (`onDotMouseDown/Move/Up`
1107/1171/1126), persistencia por workspace, y todo lo que use `Services.prefs`,
`ChromeUtils`, `gZenWorkspaces`, `PanelMultiView` o `window.windowUtils`.

---

## Ruta mínima de portado sugerida

Si solo quieres el "elige un color y genera una paleta + gradiente":

1. Copia §2 (conversiones) y §5 (`luminance`/`contrastRatio`) tal cual → util de color.
2. Copia §1 `colorHarmonies` + el cálculo de ángulos de `calculateCompliments`
   (líneas `820`–`888`) → función `harmonize(primary, harmonyType) → puntos[]`.
3. Copia §3 `getColorFromPosition` / `calculateInitialPosition` parametrizando el
   tamaño del lienzo → enlaza tu rueda de color React.
4. Copia §4 `getGradient` quitando la rama `forToolbar` si no la necesitas → string CSS
   que inyectas como `background` vía variable CSS.
5. Ignora §6 por completo; ahí va tu propio panel React + tu store de persistencia.
