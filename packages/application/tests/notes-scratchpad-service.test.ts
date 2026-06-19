import { describe, expect, it } from "vitest";

import { NotesScratchpadService, NotesService } from "../src/index.js";
import {
  createInMemoryPersistence,
  createStubFilesystem
} from "../../testkit/src/index.js";

describe("notes scratchpad service", () => {
  it("accepts edit and append Proposed Changes only after review", async () => {
    const { filesystem, scratchpad } = await createScratchpadHarness({
      "/Notes/Ideas.md": "# Ideas"
    });

    await scratchpad.stage([
      {
        content: "\n\nNew section",
        id: "change-1",
        path: "/Notes/Ideas.md",
        type: "appendNote"
      }
    ]);
    expect(await filesystem.readFile("/Notes/Ideas.md")).toBe("# Ideas");

    const accepted = await scratchpad.accept();

    expect(await filesystem.readFile("/Notes/Ideas.md")).toBe(
      "# Ideas\n\nNew section"
    );
    expect(accepted.scratchpad).toEqual({
      changes: [],
      isOpen: false
    });
  });

  it("rejects the Scratchpad without changing notebook files", async () => {
    const { filesystem, scratchpad } = await createScratchpadHarness({
      "/Notes/Ideas.md": "# Ideas"
    });

    await scratchpad.stage([
      {
        content: "# Rewritten",
        id: "change-1",
        path: "/Notes/Ideas.md",
        type: "editNote"
      }
    ]);

    await scratchpad.reject();

    expect(await filesystem.readFile("/Notes/Ideas.md")).toBe("# Ideas");
    await expect(scratchpad.hydrate()).resolves.toEqual({
      changes: [],
      isOpen: false
    });
  });

  it("accepts rename proposals through the Note Link update path", async () => {
    const { filesystem, scratchpad } = await createScratchpadHarness({
      "/Notes/Alpha.md": "# Alpha",
      "/Notes/Index.md": "Read [[Alpha]] first."
    });

    await scratchpad.stage([
      {
        id: "change-1",
        nextName: "Roadmap",
        path: "/Notes/Alpha.md",
        type: "renameNode"
      }
    ]);

    await scratchpad.accept();

    await expect(filesystem.readFile("/Notes/Alpha.md")).rejects.toThrow();
    expect(await filesystem.readFile("/Notes/Roadmap.md")).toBe("# Alpha");
    expect(await filesystem.readFile("/Notes/Index.md")).toBe(
      "Read [[Roadmap]] first."
    );
  });

  it("preflights the full Scratchpad so an invalid batch leaves no partial writes", async () => {
    const { filesystem, scratchpad } = await createScratchpadHarness({
      "/Notes/Existing.md": "# Existing",
      "/Notes/Ideas.md": "# Ideas"
    });

    await expect(
      scratchpad.stage([
        {
          content: "# Changed",
          id: "change-1",
          path: "/Notes/Ideas.md",
          type: "editNote"
        },
        {
          content: "# Duplicate",
          id: "change-2",
          path: "/Notes/Existing.md",
          type: "createNote"
        }
      ])
    ).rejects.toThrow("already exists");

    expect(await filesystem.readFile("/Notes/Ideas.md")).toBe("# Ideas");
    expect(await filesystem.readFile("/Notes/Existing.md")).toBe("# Existing");
  });
});

async function createScratchpadHarness(files: Record<string, string>) {
  const filesystem = createStubFilesystem([]);
  await filesystem.createDirectory("/Notes");
  for (const [path, content] of Object.entries(files)) {
    await filesystem.writeFile(path, content);
  }
  const persistence = createInMemoryPersistence();
  const notes = new NotesService(filesystem, persistence);
  await notes.attach("/Notes");
  return {
    filesystem,
    notes,
    scratchpad: new NotesScratchpadService(filesystem, persistence, notes)
  };
}
