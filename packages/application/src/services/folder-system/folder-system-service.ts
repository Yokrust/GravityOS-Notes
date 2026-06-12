import { basename } from "node:path";

import {
  createProject,
  type Project,
  type RoleAssignment
} from "@gravity/domain";

import type {
  FilesystemPort,
  ProjectOverview,
  ProjectState,
  IdGeneratorPort,
  PersistencePort
} from "../../contracts/index.js";
import { MapService } from "../map/map-service.js";

export class ProjectService {
  private readonly entries = new Map<string, ProjectOverview>();
  private hydrated = false;
  private selectedProjectId: string | null = null;

  constructor(
    private readonly ids: IdGeneratorPort,
    private readonly filesystem: FilesystemPort,
    private readonly mapService: MapService,
    private readonly persistence: PersistencePort
  ) {}

  async hydrate(): Promise<ProjectState> {
    await this.ensureHydrated();

    const refreshedEntries = await Promise.all(
      [...this.entries.values()].map((entry) =>
        this.describeProject(
          entry.project.rootPath,
          entry.project.id,
          entry.project.displayName,
          entry.project.roleAssignments
        )
      )
    );
    this.entries.clear();
    for (const entry of refreshedEntries) {
      this.entries.set(entry.project.id, entry);
    }
    if (this.selectedProjectId && !this.entries.has(this.selectedProjectId)) {
      this.selectedProjectId = null;
    }

    return this.toState();
  }

  async register(rootPath: string): Promise<ProjectState> {
    await this.ensureHydrated();

    const existingEntry = [...this.entries.values()].find(
      (entry) => entry.project.rootPath === rootPath
    );

    if (existingEntry) {
      this.selectedProjectId = existingEntry.project.id;
      await this.persistState();
      return this.hydrate();
    }

    const projectId = this.ids.next("project");
    const entry = await this.describeProject(rootPath, projectId);
    this.entries.set(projectId, entry);
    this.selectedProjectId ??= projectId;
    await this.persistState();

    return this.toState();
  }

  async create(rootPath: string): Promise<ProjectState> {
    await this.filesystem.createDirectory(rootPath);
    return this.register(rootPath);
  }

  async reattach(projectId: string, rootPath: string): Promise<ProjectState> {
    await this.ensureHydrated();

    const existingEntry = this.requireEntry(projectId);
    const normalizedRootPath = rootPath.trim();
    if (!normalizedRootPath) {
      throw new Error("Project context path is required.");
    }

    const conflictingEntry = [...this.entries.values()].find(
      (entry) =>
        entry.project.id !== projectId &&
        entry.project.rootPath === normalizedRootPath
    );
    if (conflictingEntry) {
      throw new Error(
        `Project context is already attached to ${conflictingEntry.project.displayName}.`
      );
    }

    const nextEntry = await this.describeProject(
      normalizedRootPath,
      projectId,
      existingEntry.project.displayName,
      existingEntry.project.roleAssignments
    );
    this.entries.set(projectId, nextEntry);
    await this.persistState();

    return this.toState();
  }

  async rename(projectId: string, displayName: string): Promise<ProjectState> {
    await this.ensureHydrated();

    const existingEntry = this.requireEntry(projectId);
    const nextEntry = await this.describeProject(
      existingEntry.project.rootPath,
      projectId,
      displayName,
      existingEntry.project.roleAssignments
    );
    this.entries.set(projectId, nextEntry);
    await this.persistState();

    return this.toState();
  }

  async select(projectId: string): Promise<ProjectState> {
    await this.ensureHydrated();
    this.requireEntry(projectId);
    this.selectedProjectId = projectId;
    await this.persistState();

    return this.toState();
  }

  async remove(projectId: string): Promise<ProjectState> {
    await this.ensureHydrated();
    this.requireEntry(projectId);
    this.entries.delete(projectId);

    if (this.selectedProjectId === projectId) {
      this.selectedProjectId =
        [...this.entries.values()][0]?.project.id ?? null;
    }
    await this.persistence.deleteProjectData(projectId);
    await this.persistState();

    return this.toState();
  }

  private async describeProject(
    rootPath: string,
    projectId: string,
    displayName = basename(rootPath) || rootPath,
    roleAssignments: RoleAssignment[] = []
  ): Promise<ProjectOverview> {
    const mapState = await this.mapService.evaluate(rootPath);
    const path = await this.filesystem.inspectPath(rootPath);
    const project: Project = createProject({
      id: projectId,
      displayName,
      rootPath,
      roleAssignments
    });

    return {
      project,
      hasRootMap: mapState.status === "present",
      pathStatus: path.status
    };
  }

  private requireEntry(projectId: string): ProjectOverview {
    const entry = this.entries.get(projectId);
    if (!entry) {
      throw new Error(`Unknown project: ${projectId}`);
    }

    return entry;
  }

  private toState(): ProjectState {
    return {
      projects: [...this.entries.values()],
      selectedProjectId: this.selectedProjectId
    };
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) {
      return;
    }

    const persistedState = await this.persistence.loadState();
    const persistedEntries = await Promise.all(
      persistedState.projects.map((project) =>
        this.describeProject(
          project.rootPath,
          project.id,
          project.displayName,
          project.roleAssignments
        )
      )
    );

    this.entries.clear();
    for (const entry of persistedEntries) {
      this.entries.set(entry.project.id, entry);
    }

    this.selectedProjectId = persistedState.appMetadata.selectedProjectId;
    if (this.selectedProjectId && !this.entries.has(this.selectedProjectId)) {
      this.selectedProjectId = null;
    }

    this.hydrated = true;
  }

  private async persistState(): Promise<void> {
    await this.persistence.saveProjects(
      [...this.entries.values()].map((entry) => entry.project)
    );
    await this.persistence.updateAppMetadata({
      selectedProjectId: this.selectedProjectId
    });
  }
}
