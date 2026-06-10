import { describe, expect, it } from "vitest";

import { NotesService } from "../src/index.js";
import {
  createInMemoryPersistence,
  createStubFilesystem
} from "../../testkit/src/index.js";

describe("notes service", () => {
  it("hydrates an empty notebook when no root has been chosen", async () => {
    const service = new NotesService(
      createStubFilesystem([]),
      createInMemoryPersistence()
    );

    await expect(service.hydrate()).resolves.toEqual({
      activeNote: null,
      activeNoteId: null,
      expandedFolders: {},
      notebookName: null,
      notebookRoot: null,
      pathStatus: null,
      tree: []
    });
  });

  it("builds a sorted note tree from folders and markdown files", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Downloads/Notes");
    await filesystem.createDirectory("/Downloads/Notes/Personal");
    await filesystem.createDirectory("/Downloads/Notes/Empty");
    await filesystem.writeFile("/Downloads/Notes/Personal/Ideas.md", "# Ideas");
    await filesystem.writeFile("/Downloads/Notes/Today.md", "# Today");
    await filesystem.writeFile("/Downloads/Notes/image.png", "binary");
    const service = new NotesService(filesystem, createInMemoryPersistence());

    await service.attach("/Downloads/Notes");

    await expect(service.hydrate()).resolves.toMatchObject({
      activeNote: {
        content: "# Ideas",
        name: "Ideas",
        path: "/Downloads/Notes/Personal/Ideas.md"
      },
      activeNoteId: "/Downloads/Notes/Personal/Ideas.md",
      notebookName: "Notes",
      notebookRoot: "/Downloads/Notes",
      pathStatus: "ready",
      tree: [
        {
          name: "Empty",
          path: "/Downloads/Notes/Empty",
          type: "folder",
          children: []
        },
        {
          name: "Personal",
          path: "/Downloads/Notes/Personal",
          type: "folder",
          children: [
            {
              name: "Ideas",
              path: "/Downloads/Notes/Personal/Ideas.md",
              type: "note"
            }
          ]
        },
        {
          name: "Today",
          path: "/Downloads/Notes/Today.md",
          type: "note"
        }
      ]
    });
  });

  it("creates, saves, renames, and deletes markdown notes on disk", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes");
    const persistence = createInMemoryPersistence();
    const service = new NotesService(filesystem, persistence);
    await service.attach("/Notes");

    const created = await service.createNote();
    expect(created.activeNoteId).toBe("/Notes/Nueva nota.md");

    await service.saveNote("/Notes/Nueva nota.md", "# Real file");
    expect(await filesystem.readFile("/Notes/Nueva nota.md")).toBe(
      "# Real file"
    );

    const renamed = await service.renameNode("/Notes/Nueva nota.md", "Mi nota");
    expect(renamed.activeNoteId).toBe("/Notes/Mi nota.md");
    expect(await filesystem.readFile("/Notes/Mi nota.md")).toBe("# Real file");

    const deleted = await service.deleteNode("/Notes/Mi nota.md");
    expect(deleted.activeNoteId).toBeNull();
    await expect(filesystem.readFile("/Notes/Mi nota.md")).rejects.toThrow();
  });

  it("rejects note operations outside the notebook root", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes");
    await filesystem.writeFile("/outside.md", "# Outside");
    const service = new NotesService(filesystem, createInMemoryPersistence());
    await service.attach("/Notes");

    await expect(service.selectNote("/outside.md")).rejects.toThrow(
      "outside the Notebook Root"
    );
  });
});
