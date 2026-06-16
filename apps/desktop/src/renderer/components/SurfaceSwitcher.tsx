import { BookOpenText, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { AppSurface } from "../lib/app-surface.js";
import { t } from "../lib/i18n.js";

export function SurfaceSwitcher({
  activeSurface,
  onSelectSurface
}: {
  activeSurface: AppSurface;
  onSelectSurface: (surface: AppSurface) => void;
}) {
  return (
    <nav aria-label={t("Superficies")} className="surface-switcher">
      <SurfaceButton
        active={activeSurface === "threads"}
        icon={<MessageCircle size={16} />}
        label="Threads"
        onClick={() => onSelectSurface("threads")}
      />
      <SurfaceButton
        active={activeSurface === "notes"}
        icon={<BookOpenText size={16} />}
        label="Notes"
        onClick={() => onSelectSurface("notes")}
      />
    </nav>
  );
}

function SurfaceButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`surface-switcher-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
