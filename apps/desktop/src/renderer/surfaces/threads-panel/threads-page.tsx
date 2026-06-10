import { SurfaceSwitcher } from "../../components/SurfaceSwitcher.js";
import type { AppSurface } from "../../lib/app-surface.js";

export function ThreadsPage({
  activeSurface,
  onSelectSurface
}: {
  activeSurface: AppSurface;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  return (
    <section className="threads-surface">
      <aside className="threads-sidebar">
        <SurfaceSwitcher
          activeSurface={activeSurface}
          onSelectSurface={onSelectSurface}
        />
      </aside>
      <main aria-label="Threads" className="threads-canvas" />
    </section>
  );
}
