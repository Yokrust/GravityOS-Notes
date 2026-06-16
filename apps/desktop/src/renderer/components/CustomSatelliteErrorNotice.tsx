import { AlertTriangle, X } from "lucide-react";

import { t } from "../lib/i18n.js";

export function CustomSatelliteErrorNotice({
  message,
  onDismiss
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="custom-satellite-error-notice" role="alert">
      <AlertTriangle aria-hidden="true" size={14} />
      <div>
        <strong>{t("No se guardaron los cambios")}</strong>
        <span>{message}</span>
      </div>
      <button aria-label={t("Cerrar aviso")} onClick={onDismiss} type="button">
        <X size={12} />
      </button>
    </div>
  );
}
