import type { QuickNote, Satellite } from "./types";

export function getLockedNoteIds(
  satellites: Satellite[],
  thisSatelliteId: string
): Set<string> {
  const locked = new Set<string>();
  for (const satellite of satellites) {
    if (satellite.kind !== "quick-note") continue;
    if (satellite.id === thisSatelliteId) continue;
    const activeId = satellite.meta?.activeQuickNoteId;
    if (activeId) locked.add(activeId);
  }
  return locked;
}

export function filterNotesByTitle(
  notes: QuickNote[],
  query: string
): QuickNote[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return notes;
  return notes.filter((note) => note.title.toLowerCase().includes(normalized));
}
