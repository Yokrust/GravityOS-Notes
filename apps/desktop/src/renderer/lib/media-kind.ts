/**
 * Renderer-side mirror of the application's media classifier. The renderer is
 * intentionally decoupled from `@gravity/application` (it already mirrors the
 * note tree types in `types.ts`), so the extension tables are duplicated here.
 * Keep them in sync with `packages/application/src/services/notes/media-kind.ts`.
 */
export type MediaKind = "image" | "video" | "audio" | "text" | "file";

/** Custom drag-and-drop MIME used to move notebook assets into a note. */
export const ASSET_DND_MIME = "application/x-gravity-asset";

export interface AssetDragPayload {
  path: string;
  name: string;
  mediaKind: MediaKind;
}

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jfif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp"
]);

const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "webm"
]);

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "weba"
]);

const TEXT_EXTENSIONS = new Set([
  "csv",
  "ini",
  "json",
  "log",
  "text",
  "tsv",
  "txt",
  "xml",
  "yaml",
  "yml"
]);

/** Returns the lowercased extension (without the dot) of a file name. */
export function fileExtension(fileName: string): string {
  const base = fileName.slice(fileName.lastIndexOf("/") + 1);
  const dotIndex = base.lastIndexOf(".");
  return dotIndex <= 0 ? "" : base.slice(dotIndex + 1).toLowerCase();
}

/** Classifies a file by extension into the kind of media it represents. */
export function classifyMediaKind(fileName: string): MediaKind {
  const extension = fileExtension(fileName);
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  return "file";
}

/** Whether dragging this kind into a note inserts content on this branch. */
export function isDraggableMediaKind(kind: MediaKind): boolean {
  return kind === "image" || kind === "text";
}
