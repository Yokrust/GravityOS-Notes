import { SatelliteCanvas } from "../../components/SatelliteCanvas.js";
import type { AppSurface } from "../../lib/app-surface.js";
import { useStore } from "../../lib/store.js";

import { NoteEditor } from "./note-editor.js";
import { NotesSidebar } from "./notes-sidebar.js";

export function NotesPage({
  activeSurface,
  onSelectSurface
}: {
  activeSurface: AppSurface;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <section
      className={`notes-surface ${sidebarOpen ? "is-sidebar-open" : "is-sidebar-closed"}`}
    >
      <button
        aria-label="Cerrar navegación"
        className="notes-sidebar-backdrop"
        onClick={toggleSidebar}
        type="button"
      />
      <NotesSidebar
        activeSurface={activeSurface}
        onSelectSurface={onSelectSurface}
      />

      <main className="notes-canvas">
        <div className="notes-canvas-inner">
          <NoteEditor />
          <SatelliteCanvas />
        </div>
      </main>
    </section>
  );
}
