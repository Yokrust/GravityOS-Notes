import {
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  win32
} from "node:path";

import { createMapState, type MapState } from "@gravity/domain";

import type { FilesystemPort, PersistencePort } from "../../contracts/index.js";
import type { MapDocumentDraft } from "../../dto/index.js";

export class MapService {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly persistence?: PersistencePort
  ) {}

  async evaluate(rootPath: string): Promise<MapState> {
    const rootMapPath = joinProjectPath(rootPath, "AGENTS.md");
    const hasRootMap = await this.filesystem.hasFile(rootMapPath);

    return createMapState({
      hasRootMap,
      rootMapPath
    });
  }

  async loadDraft(input: {
    projectId: string;
    rootPath: string;
    targetFolderPath?: string;
  }): Promise<MapDocumentDraft> {
    const targetFolderPath = this.resolveTargetFolderPath(input);
    await this.assertTargetFolderIsReady(targetFolderPath);

    const documentPath = joinProjectPath(targetFolderPath, "AGENTS.md");
    const hasDocument = await this.filesystem.hasFile(documentPath);

    return {
      actionLabel: this.createActionLabel(
        targetFolderPath,
        input.rootPath,
        hasDocument
      ),
      content: hasDocument
        ? await this.filesystem.readFile(documentPath)
        : this.createStarterTemplate(targetFolderPath, input.rootPath),
      documentPath,
      isEditingLocked: await this.isEditingLocked(input.projectId),
      isRoot: this.isRootTarget(targetFolderPath, input.rootPath),
      targetFolderPath
    };
  }

  async saveDraft(input: {
    content: string;
    projectId: string;
    rootPath: string;
    targetFolderPath?: string;
  }): Promise<MapDocumentDraft> {
    if (await this.isEditingLocked(input.projectId)) {
      throw new Error("Map editing is disabled while a Run is active.");
    }

    const targetFolderPath = this.resolveTargetFolderPath(input);
    await this.assertTargetFolderIsReady(targetFolderPath);

    await this.filesystem.writeFile(
      joinProjectPath(targetFolderPath, "AGENTS.md"),
      input.content
    );

    return this.loadDraft({
      projectId: input.projectId,
      rootPath: input.rootPath,
      targetFolderPath
    });
  }

  private async isEditingLocked(projectId: string): Promise<boolean> {
    if (!this.persistence) {
      return false;
    }

    const state = await this.persistence.loadState();
    return state.runs.some(
      (run) => run.projectId === projectId && run.status === "in_progress"
    );
  }

  private resolveTargetFolderPath(input: {
    rootPath: string;
    targetFolderPath?: string;
  }): string {
    const resolvedRootPath = resolveProjectPath(input.rootPath);
    const requestedTargetPath = input.targetFolderPath?.trim();
    const resolvedTargetPath = requestedTargetPath
      ? isProjectAbsolutePath(requestedTargetPath)
        ? resolveProjectPath(requestedTargetPath)
        : resolveProjectPath(resolvedRootPath, requestedTargetPath)
      : resolvedRootPath;
    const targetRelationship = relativeProjectPath(
      resolvedRootPath,
      resolvedTargetPath
    );

    if (
      targetRelationship.startsWith("..") ||
      targetRelationship.split(/[\\/]/).includes("..") ||
      targetRelationship.includes(":")
    ) {
      throw new Error("Nested map targets must stay within the Project.");
    }

    return normalizeProjectPath(resolvedTargetPath);
  }

  private async assertTargetFolderIsReady(
    targetFolderPath: string
  ): Promise<void> {
    const targetDetails = await this.filesystem.inspectPath(targetFolderPath);

    if (
      targetDetails.kind !== "directory" ||
      targetDetails.status !== "ready"
    ) {
      throw new Error(
        `Map target folder is not available: ${targetFolderPath}`
      );
    }
  }

  private isRootTarget(targetFolderPath: string, rootPath: string): boolean {
    return (
      normalizeProjectPath(resolveProjectPath(targetFolderPath)) ===
      normalizeProjectPath(resolveProjectPath(rootPath))
    );
  }

  private createActionLabel(
    targetFolderPath: string,
    rootPath: string,
    hasDocument: boolean
  ): string {
    if (this.isRootTarget(targetFolderPath, rootPath)) {
      return hasDocument ? "Edit Root Map" : "Create Root Map";
    }

    return hasDocument ? "Edit Nested Map" : "Add Nested Map";
  }

  private createStarterTemplate(
    targetFolderPath: string,
    rootPath: string
  ): string {
    if (this.isRootTarget(targetFolderPath, rootPath)) {
      return [
        "# AGENTS.md",
        "",
        "## Purpose",
        "Describe the overall intent of this project.",
        "",
        "## Boundaries",
        "- Note where agents should focus their work.",
        "- Call out paths that should stay unchanged.",
        "",
        "## Expected Outputs",
        "- List the files or folders agents are allowed to create or update."
      ].join("\n");
    }

    const relativePath = relativeProjectPath(
      rootPath,
      targetFolderPath
    ).replaceAll("\\", "/");

    return [
      "# AGENTS.md",
      "",
      "## Scope",
      `This nested map applies to \`${relativePath || "."}\`.`,
      "",
      "## Local Guidance",
      "- Describe what belongs in this folder.",
      "- Call out constraints that only apply here.",
      "",
      "## Handoff Notes",
      "- Explain how work in this folder should connect back to the root map."
    ].join("\n");
  }
}

function isProjectAbsolutePath(path: string): boolean {
  return isAbsolute(path) || usesWindowsPathSemantics(path);
}

function usesWindowsPathSemantics(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function joinProjectPath(basePath: string, childPath: string): string {
  return usesWindowsPathSemantics(basePath)
    ? win32.join(basePath, childPath)
    : join(basePath, childPath);
}

function normalizeProjectPath(path: string): string {
  return usesWindowsPathSemantics(path)
    ? win32.normalize(path)
    : normalize(path);
}

function relativeProjectPath(fromPath: string, toPath: string): string {
  return usesWindowsPathSemantics(fromPath) || usesWindowsPathSemantics(toPath)
    ? win32.relative(fromPath, toPath)
    : relative(fromPath, toPath);
}

function resolveProjectPath(...paths: string[]): string {
  return paths.some(usesWindowsPathSemantics)
    ? win32.resolve(...paths)
    : resolve(...paths);
}
