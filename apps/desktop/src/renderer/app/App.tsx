import type { ReactNode } from "react";
import { FilePlus, FolderPlus, PanelLeft, Settings } from "lucide-react";

import { AppearanceMenu } from "../components/AppearanceMenu.js";
import { SatelliteHubButton } from "../components/SatelliteHub.js";
import { useAppearancePreferences } from "../composition/use-appearance-preferences.js";
import type { AppSurface } from "../lib/app-surface.js";
import { useSurfaceNavigation } from "../lib/surface-navigation.js";
import { useStore } from "../lib/store.js";
import { NotesPage } from "../surfaces/notes-panel/notes-page.js";
import { SettingsPage } from "../surfaces/settings-panel/settings-page.js";
import { ThreadsPage } from "../surfaces/threads-panel/threads-page.js";

export function App() {
  const { activeSurface, selectSurface, toggleSettings } =
    useSurfaceNavigation();
  const appearance = useAppearancePreferences();

  return (
    <main className="gravity-workspace">
      <div className="board-bg" aria-hidden="true" />
      <div className="board-ambient" aria-hidden="true" />
      <TopBar activeSurface={activeSurface} onToggleSettings={toggleSettings} />
      <div className={`workspace-body is-${activeSurface}-surface`}>
        <section className="primary-region">
          {activeSurface === "settings" ? (
            <SettingsPage
              activeSurface={activeSurface}
              appearance={appearance}
              onSelectSurface={selectSurface}
            />
          ) : activeSurface === "threads" ? (
            <ThreadsPage
              activeSurface={activeSurface}
              onSelectSurface={selectSurface}
            />
          ) : (
            <NotesPage
              activeSurface={activeSurface}
              onSelectSurface={selectSurface}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function TopBar({
  activeSurface,
  onToggleSettings
}: {
  activeSurface: AppSurface;
  onToggleSettings: () => void;
}) {
  const { addFolder, addNote, notebookRoot, toggleSidebar } = useStore();
  const surfaceName = {
    notes: "Notes",
    settings: "Settings",
    threads: "Threads"
  }[activeSurface];

  return (
    <header className="top-bar">
      <div className="top-left">
        <button
          aria-label="Mostrar u ocultar navegación"
          className="navigation-toggle"
          onClick={toggleSidebar}
          type="button"
        >
          <PanelLeft size={16} strokeWidth={1.8} />
        </button>
        <div className="brand-mark">G</div>
        <span className="brand-name">Gravity</span>
        <span className="brand-rule" aria-hidden="true" />
        <span className="product-name">{surfaceName}</span>
      </div>

      <div className="top-context">
        {activeSurface === "notes"
          ? "Notebook"
          : activeSurface === "threads"
            ? "Agent harness"
            : "Configuration"}
      </div>

      <div className="top-right">
        {activeSurface === "notes" ? (
          <>
            <TopAction
              disabled={!notebookRoot}
              icon={<FilePlus size={13} />}
              onClick={() => addNote()}
            >
              Nota
            </TopAction>
            <TopAction
              disabled={!notebookRoot}
              icon={<FolderPlus size={13} />}
              onClick={() => addFolder()}
            >
              Carpeta
            </TopAction>
            <SatelliteHubButton />
          </>
        ) : null}
        <AppearanceMenu />
        <button
          aria-label="Abrir configuración"
          aria-pressed={activeSurface === "settings"}
          className={`top-settings-button ${
            activeSurface === "settings" ? "is-active" : ""
          }`}
          onClick={onToggleSettings}
          title="Configuración"
          type="button"
        >
          <Settings size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}

function TopAction({
  children,
  disabled = false,
  icon,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="top-action"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
