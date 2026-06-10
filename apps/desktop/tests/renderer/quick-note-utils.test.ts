import { describe, expect, it } from "vitest";

import {
  filterNotesByTitle,
  getLockedNoteIds
} from "../../src/renderer/lib/quick-note-utils.js";
import type { Satellite } from "../../src/renderer/lib/types.js";

function makeSatellite(
  id: string,
  kind: Satellite["kind"],
  activeQuickNoteId?: string
): Satellite {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    width: 320,
    height: 360,
    z: 1,
    meta: activeQuickNoteId !== undefined ? { activeQuickNoteId } : undefined
  };
}

describe("getLockedNoteIds", () => {
  it("returns an empty set when there are no other satellites", () => {
    expect(getLockedNoteIds([], "sat-a").size).toBe(0);
  });

  it("locks note active in another quick-note satellite", () => {
    const sats = [
      makeSatellite("sat-a", "quick-note", "note-1"),
      makeSatellite("sat-b", "quick-note", "note-2")
    ];
    const locked = getLockedNoteIds(sats, "sat-a");
    expect(locked.has("note-2")).toBe(true);
    expect(locked.has("note-1")).toBe(false);
  });
});

describe("filterNotesByTitle", () => {
  const notes = [
    { id: "n1", title: "Meeting notes", content: "", updatedAt: 1 },
    { id: "n2", title: "Shopping list", content: "", updatedAt: 2 },
    { id: "n3", title: "Book ideas", content: "", updatedAt: 3 },
    { id: "n4", title: "Sin titulo", content: "", updatedAt: 4 }
  ];

  it("returns all notes when query is empty", () => {
    expect(filterNotesByTitle(notes, "")).toHaveLength(4);
  });

  it("matches case-insensitively", () => {
    expect(filterNotesByTitle(notes, "MEETING")).toHaveLength(1);
  });

  it("does not match content, only title", () => {
    expect(
      filterNotesByTitle(
        [{ id: "n5", title: "Empty title", content: "secret", updatedAt: 5 }],
        "secret"
      )
    ).toHaveLength(0);
  });
});
