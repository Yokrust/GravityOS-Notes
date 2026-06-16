import type { MediaKind } from "../../contracts/index.js";

/**
 * Maps file extensions to the kind of asset they represent so the notebook can
 * surface non-markdown files and the editor can decide how to embed them.
 *
 * Single source of truth on the application side; the renderer keeps a small
 * mirror (`renderer/lib/media-kind.ts`) because it is intentionally decoupled
 * from this package.
 */
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
  // `dotIndex <= 0` covers files without an extension and dotfiles like `.env`.
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
