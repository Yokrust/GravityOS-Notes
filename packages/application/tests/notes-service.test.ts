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

  it("imports note images into hidden notebook assets and loads their bytes", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes/Ideas");
    await filesystem.writeFile("/Notes/Ideas/Canvas.md", "# Canvas");
    await filesystem.writeBytes(
      "/Downloads/diagram.png",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    );
    const service = new NotesService(filesystem, createInMemoryPersistence());
    await service.attach("/Notes");

    await expect(
      service.importImage("/Notes/Ideas/Canvas.md", "/Downloads/diagram.png")
    ).resolves.toEqual({
      alt: "diagram",
      source: "../.gravity-assets/diagram.png"
    });
    await expect(
      service.loadImage(
        "/Notes/Ideas/Canvas.md",
        "../.gravity-assets/diagram.png"
      )
    ).resolves.toEqual({
      bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      mimeType: "image/png"
    });
  });

  it("imports animated GIFs as regular note images", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes/Ideas");
    await filesystem.writeFile("/Notes/Ideas/Canvas.md", "# Canvas");
    const gifBytes = new Uint8Array([
      71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0
    ]);
    await filesystem.writeBytes("/Downloads/animation.gif", gifBytes);
    const service = new NotesService(filesystem, createInMemoryPersistence());
    await service.attach("/Notes");

    await expect(
      service.importImage("/Notes/Ideas/Canvas.md", "/Downloads/animation.gif")
    ).resolves.toEqual({
      alt: "animation",
      source: "../.gravity-assets/animation.gif"
    });
    await expect(
      service.loadImage(
        "/Notes/Ideas/Canvas.md",
        "../.gravity-assets/animation.gif"
      )
    ).resolves.toEqual({
      bytes: gifBytes,
      mimeType: "image/gif"
    });
  });

  it("stores pasted image bytes with the same managed asset behavior", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes");
    await filesystem.writeFile("/Notes/Canvas.md", "# Canvas");
    const service = new NotesService(filesystem, createInMemoryPersistence());
    await service.attach("/Notes");
    const gifBytes = new Uint8Array([
      71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0
    ]);

    await expect(
      service.importImageBytes("/Notes/Canvas.md", {
        bytes: gifBytes,
        fileName: "reacción-sin-extension",
        mimeType: "image/gif; charset=binary"
      })
    ).resolves.toEqual({
      alt: "reaccion-sin-extension",
      source: ".gravity-assets/reaccion-sin-extension.gif"
    });
    await expect(
      service.loadImage(
        "/Notes/Canvas.md",
        ".gravity-assets/reaccion-sin-extension.gif"
      )
    ).resolves.toEqual({
      bytes: gifBytes,
      mimeType: "image/gif"
    });
  });

  it("does not load note images from outside the notebook root", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("/Notes");
    await filesystem.writeFile("/Notes/Canvas.md", "# Canvas");
    await filesystem.writeBytes(
      "/outside.png",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    );
    const service = new NotesService(filesystem, createInMemoryPersistence());
    await service.attach("/Notes");

    await expect(
      service.loadImage("/Notes/Canvas.md", "../outside.png")
    ).rejects.toThrow("outside the Notebook Root");
  });
});
