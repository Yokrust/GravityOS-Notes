// Lightweight i18n for the Gravity renderer.
//
// The app was authored in Spanish, so Spanish strings double as translation
// keys: `t("Nueva nota")` returns the key verbatim under `es` and looks up the
// English override under `en`. This keeps the Spanish output byte-identical to
// the original UI (zero risk of regressions) while centralizing every English
// string in a single map.
//
// Language is fixed for the lifetime of a renderer session: `setLanguage`
// persists the choice and reloads, so `t` can read a module-level constant
// without a React context and every surface — including non-React code such as
// store notifications — resolves the same value.

export type Language = "es" | "en";

export const LANGUAGES: ReadonlyArray<{ id: Language; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" }
];

const STORAGE_KEY = "gravity.language";
const DEFAULT_LANGUAGE: Language = "es";

function readStoredLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "es" ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let currentLanguage: Language = readStoredLanguage();

if (typeof document !== "undefined") {
  // Helps the browser's native spell-checking and hyphenation in contentEditable.
  document.documentElement.lang = currentLanguage;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(next: Language): void {
  if (next === currentLanguage) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // If storage is blocked the reload below simply re-reads the old value.
  }
  currentLanguage = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  // A full reload re-evaluates module-level translated constants (slash menu,
  // months, …) so the whole app switches language at once, matching the
  // "the app restarts in the chosen language" expectation.
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/** BCP-47 locale for `Intl`/`toLocaleDateString` formatting. */
export function dateLocale(): string {
  return currentLanguage === "en" ? "en-US" : "es-MX";
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const resolved = currentLanguage === "en" ? (EN[key] ?? key) : key;
  return interpolate(resolved, params);
}

/** Month names (full) for the active language, January index 0. */
export function monthNames(): string[] {
  return currentLanguage === "en" ? MONTHS_EN : MONTHS_ES;
}

/** Single-letter weekday headers, Monday first, for the active language. */
export function weekdayInitials(): string[] {
  return currentLanguage === "en" ? DOW_EN : DOW_ES;
}

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"];
const DOW_EN = ["M", "T", "W", "T", "F", "S", "S"];

// Spanish source string -> English translation. Missing entries fall back to
// the Spanish key, which keeps the UI usable even if a string is added without
// its translation.
const EN: Record<string, string> = {
  // App / top bar
  "Mostrar u ocultar navegación": "Show or hide navigation",
  Nota: "Note",
  Carpeta: "Folder",
  "Abrir configuración": "Open settings",
  Configuración: "Settings",

  // Settings sections
  "Conecta los modelos que usará Gravity.":
    "Connect the models Gravity will use.",
  "Api provider": "API provider",
  Disponible: "Available",
  "Personaliza cómo se siente y se comporta Gravity.":
    "Customize how Gravity feels and behaves.",
  "Elige cómo Gravity llama tu atención.":
    "Choose how Gravity gets your attention.",
  Próximamente: "Coming soon",
  "Configura cuentas y entrega de correo.":
    "Configure mail accounts and delivery.",
  "Administra espacios compartidos y miembros.":
    "Manage shared spaces and members.",
  "Secciones de configuración": "Settings sections",

  // Appearance card
  Ambiente: "Ambience",
  "Guardado en este equipo": "Saved on this device",
  Cargando: "Loading",
  Restaurar: "Restore",
  "Crea una paleta armónica o mueve cada color libremente. Los cambios se aplican en vivo a Gravity y se conservan al reiniciar la aplicación.":
    "Build a harmonic palette or move each color freely. Changes apply to Gravity live and persist after restarting the app.",
  "Cargando ambiente": "Loading ambience",
  "Gravity está recuperando tus preferencias guardadas.":
    "Gravity is restoring your saved preferences.",

  // Language card
  Idioma: "Language",
  "Elige el idioma de toda la aplicación.":
    "Choose the language for the entire app.",
  "La aplicación se reiniciará para aplicar el idioma.":
    "The app will restart to apply the language.",
  "En español, Gravity corrige automáticamente los acentos mientras escribes tus notas.":
    "In Spanish, Gravity automatically fixes accents as you write your notes.",
  "Corrección de acentos activa": "Accent correction on",

  // Provider settings
  "Cargando proveedores": "Loading providers",
  "Gravity está consultando las conexiones disponibles en este equipo.":
    "Gravity is checking the connections available on this device.",
  "Inicio de sesión": "Sign in",
  "En curso": "In progress",
  "Abrir autorización": "Open authorization",
  Continuar: "Continue",
  Conectado: "Connected",
  "Sin configurar": "Not configured",
  "Pega una nueva clave": "Paste a new key",
  Guardar: "Save",
  "Conectar con OAuth": "Connect with OAuth",
  Desconectar: "Disconnect",
  "En preparación": "In preparation",
  "Esta sección ya tiene un lugar estable en Configuración. Sus controles se habilitarán cuando la capacidad esté disponible.":
    "This section already has a stable place in Settings. Its controls will be enabled when the capability is available.",

  // Notes sidebar
  "Cerrar navegación": "Close navigation",
  "Doble clic para cambiar el nombre": "Double-click to rename",
  "Cambiar nombre de {name}": "Rename {name}",
  "Nueva nota aquí": "New note here",
  "Nueva carpeta aquí": "New folder here",
  '¿Eliminar la carpeta "{name}" y todo su contenido?':
    'Delete the folder "{name}" and all its contents?',
  "Eliminar carpeta": "Delete folder",
  "Arrastra a una nota para añadirlo": "Drag onto a note to add it",
  '¿Eliminar "{name}"?': 'Delete "{name}"?',
  Eliminar: "Delete",
  '¿Eliminar la nota "{name}"?': 'Delete the note "{name}"?',
  "Árbol de notas": "Notes tree",
  Cuaderno: "Notebook",
  "Sin carpeta": "No folder",
  "Nueva nota": "New note",
  "Nueva carpeta": "New folder",
  "Elegir carpeta": "Choose folder",
  Archivos: "Files",
  "Recargar árbol": "Reload tree",
  "Recargar cambios del disco": "Reload changes from disk",
  "Cambiar carpeta": "Change folder",
  "Cambiar carpeta del cuaderno": "Change notebook folder",
  "La carpeta del cuaderno no está disponible.":
    "The notebook folder is unavailable.",
  "Esta carpeta todavía no contiene notas Markdown.":
    "This folder doesn't contain any Markdown notes yet.",

  // Note editor
  ahora: "now",
  "hace {n} min": "{n} min ago",
  "hace {n} h": "{n} h ago",
  "hace {n} d": "{n} d ago",
  "Leyendo cuaderno": "Reading notebook",
  "Selecciona una nota": "Select a note",
  "Abre tu carpeta de notas": "Open your notes folder",
  "Elige una nota del árbol o crea una nueva.":
    "Pick a note from the tree or create a new one.",
  "Conecta una carpeta y empieza a escribir.":
    "Connect a folder and start writing.",
  "Título de la nota": "Note title",
  "Sin título": "Untitled",
  "{count} palabras": "{count} words",
  "{count} caracteres": "{count} characters",

  // Appearance menu
  Apariencia: "Appearance",
  Tema: "Theme",
  Acento: "Accent",
  "Acento personalizado": "Custom accent",
  "Elegir color de acento": "Choose accent color",
  "Cristal y Cristal Noche recrean el vidrio líquido de Apple en día y noche: superficies translúcidas sobre una malla de color viva.":
    "Crystal and Crystal Night recreate Apple's liquid glass by day and night: translucent surfaces over a vivid color mesh.",
  Grafito: "Graphite",
  Porcelana: "Porcelain",
  Cristal: "Crystal",
  "Cristal Noche": "Crystal Night",
  Violeta: "Violet",
  Azul: "Blue",
  Menta: "Mint",
  Ámbar: "Amber",
  Rosa: "Pink",

  // Surface switcher
  Superficies: "Surfaces",

  // Theme picker
  Complementario: "Complementary",
  Sencillo: "Simple",
  Dividido: "Split",
  Análogo: "Analogous",
  Triádico: "Triadic",
  Libre: "Free",
  Auto: "Auto",
  Claro: "Light",
  Oscuro: "Dark",
  "Esquema de color": "Color scheme",
  "{count} colores": "{count} colors",
  "Paleta automática": "Automatic palette",
  "Rueda de color": "Color wheel",
  "Arrastra un punto. En Libre, selecciona y mueve cada color.":
    "Drag a point. In Free, select and move each color.",
  Armonía: "Harmony",
  Colores: "Colors",
  "Quitar color": "Remove color",
  "Añadir color": "Add color",
  "Editar color {n}": "Edit color {n}",
  "Color activo": "Active color",
  "Color personalizado": "Custom color",
  Opacidad: "Opacity",
  Textura: "Texture",
  Ángulo: "Angle",
  "Vista previa del ambiente": "Ambience preview",

  // Satellite hub
  Calendario: "Calendar",
  Satélites: "Satellites",
  Abierto: "Open",
  "Mis satélites": "My satellites",
  "Ninguno aún.": "None yet.",
  Reabrir: "Reopen",
  "Eliminar {name}": "Delete {name}",
  "su instancia y todos sus datos": "its instance and all its data",
  "{count} instancias y todos sus datos":
    "{count} instances and all their data",
  '¿Eliminar permanentemente "{name}", {summary}?':
    'Permanently delete "{name}", {summary}?',
  "Eliminar Satellite inventado": "Delete custom Satellite",
  "Crear Satellite": "Create Satellite",

  // Satellite creator
  "La generación de Satellites está disponible en la app de escritorio.":
    "Satellite generation is available in the desktop app.",
  "Revisa la propuesta": "Review the proposal",
  "Describe la herramienta": "Describe the tool",
  Cerrar: "Close",
  "Cambiar descripción": "Change description",
  Nombre: "Name",
  Descripción: "Description",
  Color: "Color",
  Información: "Information",
  "Nombre de {label}": "Name of {label}",
  "Quitar {label}": "Remove {label}",
  "Sin nombre": "Unnamed",
  Cancelar: "Cancel",
  Guardando: "Saving",
  "Guardar Satellite": "Save Satellite",
  "¿Qué debe ayudarte a hacer este Satellite?":
    "What should this Satellite help you do?",
  "Ejemplo: Quiero organizar los personajes de una novela.":
    "Example: I want to organize the characters in a novel.",
  "La IA no accede a tus Notes ni archivos.":
    "The AI does not access your Notes or files.",
  Generando: "Generating",
  "Generar Satellite": "Generate Satellite",
  "No se pudo crear el Satellite.": "Couldn't create the Satellite.",

  // Calendar
  "Una vez": "Once",
  Diario: "Daily",
  Semanal: "Weekly",
  diario: "daily",
  semanal: "weekly",
  recordatorio: "reminder",
  recordatorios: "reminders",
  Hoy: "Today",
  "Añadir recordatorio": "Add reminder",
  "Recordatorio…": "Reminder…",
  "Sin recordatorios para este día.": "No reminders for this day.",
  "Eliminar serie completa": "Delete entire series",

  // Pomodoro
  "Foco · 25:00": "Focus · 25:00",
  "Descanso · 05:00": "Break · 05:00",
  "Descanso largo · 15:00": "Long break · 15:00",
  "{count} ciclos": "{count} cycles",
  "{count} descansos": "{count} breaks",
  Foco: "Focus",
  Descanso: "Break",
  "Descanso largo": "Long break",

  // Quick note
  Editar: "Edit",
  "Notas guardadas": "Saved notes",
  "{count} carácter": "{count} character",
  "Tamaño de texto": "Text size",
  Título: "Title",
  "Empieza a escribir…": "Start writing…",
  nueva: "new",
  "Buscar…": "Search…",
  "Abierta en otra ventana": "Open in another window",

  // Custom satellite
  "¿Eliminar permanentemente esta instancia y todos sus datos?":
    "Permanently delete this instance and all its data?",
  "Eliminar Satellite": "Delete Satellite",
  "Limpiar {label}": "Clear {label}",
  Limpiar: "Clear",
  Requerido: "Required",
  Seleccionar: "Select",
  "Sin valor": "No value",
  "Sin imagen": "No image",

  // Custom satellite error notice
  "No se guardaron los cambios": "Changes weren't saved",
  "Cerrar aviso": "Close notice",

  // Block editor — inline toolbar
  Negrita: "Bold",
  Cursiva: "Italic",
  Subrayado: "Underline",
  Tachado: "Strikethrough",
  "Código en línea": "Inline code",
  "Quitar formato": "Clear formatting",
  Enlace: "Link",
  Marcatexto: "Highlight",
  "Marcatexto {color}": "Highlight {color}",
  "Quitar marcatexto": "Remove highlight",
  "Alinear texto": "Align text",
  "Alinear texto a la izquierda": "Align left",
  "Centrar texto": "Center text",
  "Alinear texto a la derecha": "Align right",
  "Justificar texto": "Justify text",
  "Dirección del enlace": "Link address",
  Aplicar: "Apply",

  // Block editor — placeholders
  "Escribe '/' para comandos…": "Type '/' for commands…",
  "Encabezado 1": "Heading 1",
  "Encabezado 2": "Heading 2",
  "Encabezado 3": "Heading 3",
  "Cita…": "Quote…",
  "Elemento de lista": "List item",
  Tarea: "Task",
  Código: "Code",

  // Block editor — media
  imagen: "image",
  video: "video",
  "Opciones de {mediaLabel}": "Options for {mediaLabel}",
  Acomodar: "Arrange",
  "Ajuste de texto para {mediaLabel}": "Text wrap for {mediaLabel}",
  "Ajuste de texto": "Text wrap",
  "Sin ajuste": "No wrap",
  "Texto a la derecha de la {mediaLabel}":
    "Text to the right of the {mediaLabel}",
  "Texto a la izquierda de la {mediaLabel}":
    "Text to the left of the {mediaLabel}",
  Alineación: "Alignment",
  Izquierda: "Left",
  Centro: "Center",
  Derecha: "Right",
  "Alinear {mediaLabel} a la izquierda": "Align {mediaLabel} left",
  "Alinear {mediaLabel} al centro": "Align {mediaLabel} center",
  "Alinear {mediaLabel} a la derecha": "Align {mediaLabel} right",
  "Tamaño de la {mediaLabel}": "Size of the {mediaLabel}",
  Tamaño: "Size",
  "No se pudo cargar la imagen": "Couldn't load the image",
  "Enlace de video no compatible": "Unsupported video link",
  "Redimensionar {mediaLabel} desde la esquina izquierda":
    "Resize {mediaLabel} from the left corner",
  "Redimensionar {mediaLabel} desde la esquina derecha":
    "Resize {mediaLabel} from the right corner",
  "Arrastra para cambiar el tamaño": "Drag to resize",

  // Block editor — video dialog
  "Insertar video": "Insert video",
  "YouTube, Vimeo, Loom, Dailymotion o un archivo HTTPS directo.":
    "YouTube, Vimeo, Loom, Dailymotion, or a direct HTTPS file.",
  "Enlace del video": "Video link",
  "Usa un enlace HTTPS de un proveedor compatible.":
    "Use an HTTPS link from a supported provider.",
  Insertar: "Insert",

  // Block editor — code
  Lenguaje: "Language",
  "Lenguaje del código": "Code language",
  "Escribe o pega código…": "Type or paste code…",
  Automático: "Automatic",
  Texto: "Text",

  // Block editor — block labels, previews & inserters
  "Línea divisoria": "Divider line",
  "Bloque vacío": "Empty block",
  "Escribir antes del bloque": "Write before the block",
  "Escribir después del bloque": "Write after the block",
  "Escribir entre los bloques": "Write between the blocks",
  "Arrastra aquí para eliminar": "Drag here to delete",
  "Suelta para eliminar": "Drop to delete",
  "Arrastrar bloque: {label}": "Drag block: {label}",

  // Block editor — divider / table
  Divisor: "Divider",
  "Redimensionar tabla": "Resize table",
  "Arrastra para añadir o quitar filas y columnas":
    "Drag to add or remove rows and columns",

  // Block editor — slash menu
  Bloques: "Blocks",
  "Párrafo simple": "Simple paragraph",
  "Título principal": "Main title",
  Sección: "Section",
  "Sub-sección": "Sub-section",
  Lista: "List",
  Viñetas: "Bullets",
  "Casilla con texto": "Checkbox with text",
  Cita: "Quote",
  "Frase destacada": "Highlighted phrase",
  "Bloque monoespaciado": "Monospaced block",
  "Línea horizontal": "Horizontal line",
  Imagen: "Image",
  "Archivo local redimensionable": "Resizable local file",
  "YouTube, Vimeo, Loom y más": "YouTube, Vimeo, Loom and more",
  Tabla: "Table",

  // Store — notifications & errors
  "¡A enfocarte! Ciclo de foco (25 min)": "Time to focus! Focus cycle (25 min)",
  "¡Buen trabajo! Tómate un descanso (5 min)":
    "Nice work! Take a break (5 min)",
  "¡Gran sesión! Descanso largo (15 min)": "Great session! Long break (15 min)",
  Recordatorio: "Reminder",
  "No se pudo consultar el estado guardado.": "Couldn't read the saved state.",
  "Las imágenes deben pesar entre 1 byte y 5 MB.":
    "Images must be between 1 byte and 5 MB.",
  "Formato de imagen no compatible.": "Unsupported image format.",
  "No se pudo actualizar el cuaderno.": "Couldn't update the notebook."
};
