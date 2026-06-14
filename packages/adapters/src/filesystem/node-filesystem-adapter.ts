import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep
} from "node:path";

import type {
  DirectoryEntry,
  FilesystemPort,
  PathDetails
} from "@gravity/application";

export class NodeFilesystemAdapter implements FilesystemPort {
  baseName(path: string): string {
    return basename(path);
  }

  async deletePath(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<void> {
    await rm(path, {
      force: true,
      recursive: options?.recursive ?? false
    });
  }

  directoryName(path: string): string {
    return dirname(path).replaceAll("\\", "/");
  }

  async hasFile(path: string): Promise<boolean> {
    try {
      const fileStat = await stat(path);
      return fileStat.isFile();
    } catch {
      return false;
    }
  }

  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });

    return entries.map((entry) => ({
      path: resolve(path, entry.name).replaceAll("\\", "/"),
      type: entry.isDirectory()
        ? "directory"
        : entry.isFile()
          ? "file"
          : "other"
    }));
  }

  isPathInside(rootPath: string, targetPath: string): boolean {
    const relativeTarget = relative(resolve(rootPath), resolve(targetPath));
    return (
      relativeTarget === "" ||
      (!relativeTarget.startsWith(`..${sep}`) &&
        relativeTarget !== ".." &&
        !isAbsolute(relativeTarget))
    );
  }

  async inspectPath(path: string): Promise<PathDetails> {
    try {
      const pathStat = await stat(path);

      if (pathStat.isDirectory()) {
        await readdir(path, { withFileTypes: true });
        return {
          kind: "directory",
          modifiedAt: pathStat.mtimeMs,
          status: "ready"
        };
      }

      if (pathStat.isFile()) {
        return {
          kind: "file",
          modifiedAt: pathStat.mtimeMs,
          status: "ready"
        };
      }

      return { kind: null, status: "unreadable" };
    } catch (error) {
      if (isMissingError(error)) {
        return { kind: null, status: "missing" };
      }

      return { kind: null, status: "unreadable" };
    }
  }

  async readFile(path: string): Promise<string> {
    return readFile(path, "utf8");
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return readFile(path);
  }

  async movePath(sourcePath: string, destinationPath: string): Promise<void> {
    await rename(sourcePath, destinationPath);
  }

  relativePath(fromPath: string, toPath: string): string {
    return relative(fromPath, toPath).replaceAll("\\", "/");
  }

  resolvePath(path: string, ...segments: string[]): string {
    return resolve(path, ...segments).replaceAll("\\", "/");
  }

  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, "utf8");
  }

  async writeBytes(path: string, content: Uint8Array): Promise<void> {
    await writeFile(path, content);
  }
}

function isMissingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
