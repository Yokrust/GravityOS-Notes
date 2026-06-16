// Spanish accent auto-correction.
//
// When the app language is Spanish, completed words are accented with their
// correct diacritics ("rapido" -> "rápido", "informacion" -> "información").
// Coverage comes from three layers, in priority order:
//   1. A large embedded lexicon of accented Spanish words (spanish-accents-data),
//      restricted to the *safe* subset whose accent-less spelling is not itself a
//      valid, different Spanish word.
//   2. A small hand-curated list of very common nouns whose bare spelling does
//      collide with a rare verb form (página, médico, número, género…), where the
//      noun is overwhelmingly the intended word.
//   3. Productive morphological rules for families the flat lists can't enumerate
//      (‑ción/‑sión, ‑ísimo, ‑mente, feminine ‑o→‑a, plural +s).
//
// Design constraints that keep this safe:
//   - Only words carrying an accent mark (á é í ó ú) are corrected, so it stays
//     true to "acentos" and never touches ñ-only words (no ano/año surprises).
//   - Ambiguous monosyllables and homographs whose unaccented form is itself a
//     valid, different word are excluded (esta/está, el/él, tu/tú, si/sí,
//     mas/más, solo/sólo, como/cómo, hacia/hacía, …).
//   - Every layer preserves length (diacritics replace a letter), so callers can
//     keep the caret position after an in-place fix.

import { ACCENTED_LEXICON } from "./spanish-accents-data.js";

// Hand-curated common words. Every entry contains at least one of á é í ó ú.
// Kept in addition to the embedded lexicon because these collide with a rare
// verb form and would otherwise be dropped by the safety filter.
const ACCENTED_WORDS = [
  // Adverbs & connectors
  "también",
  "además",
  "así",
  "asimismo",
  "aquí",
  "ahí",
  "allí",
  "allá",
  "acá",
  "después",
  "atrás",
  "detrás",
  "través",
  "jamás",
  "quizás",
  "demás",
  "encontré",
  "rápido",
  "rápida",
  "rápidamente",
  "fácil",
  "fácilmente",
  "difícil",
  "difícilmente",
  "fácilmente",
  // Common adjectives (no accent-less verb collision)
  "débil",
  "débiles",
  "hábil",
  "ágil",
  "frágil",
  "útil",
  "inútil",
  "fútil",
  "dócil",
  "móvil",
  "automóvil",
  "fértil",
  "versátil",
  "portátil",
  "común",
  "según",
  "jardín",
  "jardines",
  "joven",
  "jóvenes",
  "íntimo",
  "último",
  "última",
  "últimos",
  "últimas",
  "próximo",
  "próxima",
  "único",
  "única",
  "únicos",
  "únicas",
  "máximo",
  "mínimo",
  "óptimo",
  "pésimo",
  "típico",
  "típica",
  "teórico",
  "técnico",
  "técnica",
  "físico",
  "física",
  "químico",
  "química",
  "lógico",
  "lógica",
  "mágico",
  "trágico",
  "cómico",
  "histórico",
  "histórica",
  "específico",
  "automático",
  "electrónico",
  "fantástico",
  "dramático",
  "económico",
  "académico",
  "clásico",
  "plástico",
  "básico",
  "dinámico",
  "romántico",
  "magnífico",
  "científico",
  "geográfico",
  "simpático",
  "antipático",
  "diáfano",
  "cálido",
  "rígido",
  "líquido",
  "sólido",
  "ácido",
  "árido",
  "ávido",
  "válido",
  "cándido",
  "espléndido",
  "héroe",
  "héroes",
  // Proparoxytone nouns (stable, non-verb)
  "música",
  "página",
  "páginas",
  "médico",
  "médica",
  "médicos",
  "número",
  "números",
  "género",
  "método",
  "título",
  "capítulo",
  "artículo",
  "vehículo",
  "círculo",
  "obstáculo",
  "espectáculo",
  "ridículo",
  "músculo",
  "ángulo",
  "máquina",
  "máquinas",
  "máscara",
  "lágrima",
  "brújula",
  "fórmula",
  "célula",
  "cápsula",
  "partícula",
  "matrícula",
  "película",
  "películas",
  "teléfono",
  "teléfonos",
  "micrófono",
  "sinónimo",
  "anónimo",
  "síntoma",
  "párrafo",
  "océano",
  "plátano",
  "huérfano",
  "cráneo",
  "espontáneo",
  "simultáneo",
  "época",
  "épocas",
  "área",
  "áreas",
  "árbol",
  "árboles",
  "lápiz",
  "lápices",
  "ángel",
  "ángeles",
  "ámbar",
  "águila",
  "álbum",
  "álgebra",
  "índice",
  "índices",
  "élite",
  "óxido",
  "límite",
  "límites",
  "régimen",
  "imágenes",
  "exámenes",
  "fenómeno",
  "teléfono",
  "kilómetro",
  "kilómetros",
  "centímetro",
  "milímetro",
  "parámetro",
  "diámetro",
  "perímetro",
  "régimen",
  "préstamo",
  "préstamos",
  "máquina",
  "víctima",
  "víctimas",
  "víspera",
  "década",
  "décadas",
  "cámara",
  "cámaras",
  "página",
  "sábado",
  "sábados",
  "miércoles",
  "sílaba",
  "fábula",
  "ráfaga",
  "rúbrica",
  "sátira",
  "símbolo",
  "símbolos",
  "época",
  "ánimo",
  "régimen",
  "música",
  // -ía nouns (no accent-less verb collision)
  "día",
  "días",
  "tío",
  "tía",
  "tíos",
  "tías",
  "río",
  "ríos",
  "frío",
  "fríos",
  "sandía",
  "policía",
  "comisaría",
  "librería",
  "panadería",
  "carnicería",
  "cafetería",
  "batería",
  "galería",
  "mayoría",
  "minoría",
  "garantía",
  "categoría",
  "categorías",
  "melodía",
  "alegría",
  "sabiduría",
  "energía",
  "economía",
  "compañía",
  "tecnología",
  "biología",
  "psicología",
  "geología",
  "ecología",
  "mitología",
  "antología",
  "fotografía",
  "biografía",
  "geografía",
  "filosofía",
  "astronomía",
  "anatomía",
  "autonomía",
  "ironía",
  "sinfonía",
  "armonía",
  "monarquía",
  "jerarquía",
  "mercancía",
  "cortesía",
  "fantasía",
  "poesía",
  "vía",
  "vías",
  "guía",
  "bahía",
  "país",
  "países",
  "raíz",
  "raíces",
  "maíz",
  "baúl",
  "líder",
  "líderes",
  "símbolo",
  // -ción / -sión / -ón nouns (zero verb collision)
  "acción",
  "atención",
  "intención",
  "canción",
  "canciones",
  "información",
  "situación",
  "dirección",
  "educación",
  "relación",
  "relaciones",
  "posición",
  "condición",
  "decisión",
  "televisión",
  "versión",
  "ocasión",
  "presión",
  "opción",
  "opciones",
  "función",
  "funciones",
  "sección",
  "estación",
  "generación",
  "población",
  "organización",
  "aplicación",
  "comunicación",
  "programación",
  "evaluación",
  "operación",
  "administración",
  "construcción",
  "producción",
  "descripción",
  "definición",
  "navegación",
  "configuración",
  "conexión",
  "revisión",
  "división",
  "discusión",
  "expresión",
  "impresión",
  "profesión",
  "dimensión",
  "extensión",
  "evolución",
  "solución",
  "soluciones",
  "institución",
  "distribución",
  "contribución",
  "constitución",
  "ejecución",
  "invención",
  "prevención",
  "reunión",
  "religión",
  "región",
  "opinión",
  "opiniones",
  "unión",
  "tensión",
  "misión",
  "emoción",
  "emociones",
  "nación",
  "oración",
  "lección",
  "colección",
  "elección",
  "elecciones",
  "protección",
  "selección",
  "corrección",
  "conclusión",
  "ilusión",
  "excepción",
  "recepción",
  "percepción",
  "adopción",
  "ficción",
  "traducción",
  "reducción",
  "introducción",
  "reproducción",
  "satisfacción",
  "publicación",
  "justificación",
  "clasificación",
  "modificación",
  "verificación",
  "identificación",
  "recomendación",
  "presentación",
  "representación",
  "alimentación",
  "documentación",
  "orientación",
  "interpretación",
  "conversación",
  "observación",
  "preparación",
  "separación",
  "exploración",
  "decoración",
  "celebración",
  "colaboración",
  "declaración",
  "consideración",
  "recuperación",
  "transformación",
  "formación",
  "confirmación",
  "afirmación",
  "animación",
  "imaginación",
  "determinación",
  "coordinación",
  "eliminación",
  "combinación",
  "motivación",
  "innovación",
  "conservación",
  "realización",
  "utilización",
  "actualización",
  "autorización",
  "corazón",
  "corazones",
  "razón",
  "razones",
  "jamón",
  "limón",
  "ratón",
  "balcón",
  "rincón",
  "camión",
  "camiones",
  "avión",
  "aviones",
  "millón",
  "millones",
  "billón",
  "montón",
  "sillón",
  "algodón",
  "botón",
  "botones",
  "talón",
  "jabón",
  "cajón",
  "buzón",
  "melón",
  "tapón",
  "salón",
  "bombón",
  "campeón",
  "pulmón",
  "riñón",
  "tiburón",
  "capitán",
  "capitanes",
  "según",
  // Places & proper nouns
  "américa",
  "áfrica",
  "méxico",
  "perú",
  "panamá",
  "bogotá",
  "japón",
  "bélgica",
  "málaga",
  "córdoba",
  "león"
];

const WORD_CHAR = "A-Za-zÁÉÍÓÚáéíóúÜüÑñ";
const WORD_RE = new RegExp(`[${WORD_CHAR}]+`, "g");
const HAS_DIACRITIC_RE = /[ÁÉÍÓÚáéíóúÜü]/;
const BOUNDARY_RE = /[\s.,;:!?)\]}"'»…¿¡(]/;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Bare (lowercase) key -> accented lowercase form. Built lazily on first use so
// parsing the ~100k-word lexicon never blocks app or note-editor startup; the
// one-time cost is paid on the first keystroke instead. The hand-curated list is
// applied last so its deliberate common-noun choices win over any lexicon entry.
let accentMapCache: Map<string, string> | null = null;
function accentMap(): Map<string, string> {
  if (accentMapCache) return accentMapCache;
  const map = new Map<string, string>();
  for (const word of ACCENTED_LEXICON.split("\n")) {
    if (!word) continue;
    const key = stripDiacritics(word);
    if (key !== word) map.set(key, word);
  }
  for (const word of ACCENTED_WORDS) {
    const lower = word.toLowerCase();
    const key = stripDiacritics(lower);
    if (key !== lower) map.set(key, lower);
  }
  accentMapCache = map;
  return map;
}

// Superlative endings: the bare spelling is never a valid word, so the accent
// can always be added. e.g. "rapidisimo" -> "rapidísimo".
const SUPERLATIVE_SUFFIXES: Array<{ bare: string; accented: string }> = [
  { bare: "isimo", accented: "ísimo" },
  { bare: "isima", accented: "ísima" },
  { bare: "isimos", accented: "ísimos" },
  { bare: "isimas", accented: "ísimas" }
];

/** Resolve the accented (lowercase) form of a bare lowercase word, or null.
 *  Tries the flat map, then productive morphological families. Every branch
 *  preserves length. */
function resolveAccentedLower(key: string): string | null {
  const direct = accentMap().get(key);
  if (direct) return direct;

  // -ción / -sión nouns (singular): always accented, never a plain word.
  if (key.length > 4 && (key.endsWith("cion") || key.endsWith("sion"))) {
    return key.slice(0, -4) + (key.endsWith("cion") ? "ción" : "sión");
  }

  // Superlatives -ísimo/a/os/as.
  for (const { bare, accented } of SUPERLATIVE_SUFFIXES) {
    if (key.length > bare.length + 1 && key.endsWith(bare)) {
      return key.slice(0, -bare.length) + accented;
    }
  }

  // Adverbs in -mente built on an accented (feminine) adjective.
  if (key.length > 7 && key.endsWith("mente")) {
    const base = resolveAccentedLower(key.slice(0, -5));
    if (base) return base + "mente";
  }

  // Feminine -a derived from an accented masculine -o (rápido → rápida).
  if (key.length > 3 && key.endsWith("a")) {
    const masculine = resolveAccentedLower(`${key.slice(0, -1)}o`);
    if (masculine && masculine.endsWith("o")) {
      return `${masculine.slice(0, -1)}a`;
    }
  }

  // Plural +s from an accented singular (rápido → rápidos, página → páginas).
  if (key.length > 3 && key.endsWith("s")) {
    const singular = resolveAccentedLower(key.slice(0, -1));
    if (singular) return `${singular}s`;
  }

  return null;
}

function applyCase(original: string, accentedLower: string): string {
  const hasLower = original !== original.toUpperCase();
  const hasUpper = original !== original.toLowerCase();
  if (original.length > 1 && hasUpper && !hasLower) {
    return accentedLower.toUpperCase();
  }
  const first = original[0] ?? "";
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return accentedLower.charAt(0).toUpperCase() + accentedLower.slice(1);
  }
  return accentedLower;
}

/** Correct a single, already-isolated word. Returns it unchanged if it carries
 *  diacritics already, contains digits, or has no known accented form. */
export function correctSpanishWord(word: string): string {
  if (!word || HAS_DIACRITIC_RE.test(word) || /\d/.test(word)) return word;
  const accented = resolveAccentedLower(word.toLowerCase());
  return accented ? applyCase(word, accented) : word;
}

/** Correct the word that ends immediately before `boundaryIndex` (the index of
 *  a just-typed separator). Length is preserved, so the caret stays valid. */
export function correctWordBeforeIndex(
  text: string,
  boundaryIndex: number
): string {
  let start = boundaryIndex;
  const isWordChar = new RegExp(`[${WORD_CHAR}]`);
  while (start > 0 && isWordChar.test(text[start - 1] ?? "")) start -= 1;
  if (start >= boundaryIndex) return text;
  const word = text.slice(start, boundaryIndex);
  const corrected = correctSpanishWord(word);
  if (corrected === word) return text;
  return text.slice(0, start) + corrected + text.slice(boundaryIndex);
}

export { BOUNDARY_RE };

/** Live correction for a controlled `<input>`/`<textarea>`: when the user has
 *  just typed a word boundary, the preceding word is accented in place. Accent
 *  substitution preserves length, so the caret is restored to where it was.
 *  Returns the value the caller should commit to state. */
export function autocorrectInputElement(
  element: HTMLInputElement | HTMLTextAreaElement
): string {
  const value = element.value;
  const caret = element.selectionStart ?? value.length;
  const previous = value[caret - 1];
  if (previous === undefined || !BOUNDARY_RE.test(previous)) return value;

  const corrected = correctWordBeforeIndex(value, caret - 1);
  if (corrected === value) return value;

  const start = element.selectionStart;
  const end = element.selectionEnd;
  requestAnimationFrame(() => {
    try {
      element.setSelectionRange(start ?? caret, end ?? caret);
    } catch {
      // The input may have unmounted before the frame ran.
    }
  });
  return corrected;
}

/** Live correction for a `contentEditable` editor: when the caret sits just
 *  after a freshly typed word boundary, accent the word before it directly in
 *  the DOM text node and restore the caret. Length is preserved, so the caret
 *  offset stays valid. Returns true when the DOM was changed (the caller should
 *  re-serialize). */
export function autocorrectCaretWord(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE || !editor.contains(node)) return false;

  const offset = range.startOffset;
  const text = node.textContent ?? "";
  const boundary = text[offset - 1];
  if (boundary === undefined || !BOUNDARY_RE.test(boundary)) return false;

  const corrected = correctWordBeforeIndex(text, offset - 1);
  if (corrected === text) return false;

  node.textContent = corrected;
  const restored = document.createRange();
  restored.setStart(node, Math.min(offset, corrected.length));
  restored.collapse(true);
  selection.removeAllRanges();
  selection.addRange(restored);
  return true;
}

/** Correct every completed word in a block of text. Inline code spans, markdown
 *  link targets, raw URLs and emails are protected so their literals are never
 *  rewritten. */
export function correctSpanishText(text: string): string {
  if (!text) return text;
  const holds: string[] = [];
  const hold = (value: string) => {
    const token = `${holds.length}`;
    holds.push(value);
    return token;
  };

  const protectedText = text
    .replace(/`[^`]*`/g, hold)
    .replace(/\]\([^)]*\)/g, hold)
    .replace(/\bhttps?:\/\/[^\s)]+/gi, hold)
    .replace(/\b[\w.+-]+@[\w-]+\.[A-Za-z]{2,}\b/g, hold);

  const corrected = protectedText.replace(WORD_RE, (word) =>
    correctSpanishWord(word)
  );

  return corrected.replace(
    /(\d+)/g,
    (_, index: string) => holds[Number(index)] ?? ""
  );
}
