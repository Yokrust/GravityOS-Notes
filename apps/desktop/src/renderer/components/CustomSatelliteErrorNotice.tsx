import { AlertTriangle, X } from "lucide-react";

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
        <strong>No se guardaron los cambios</strong>
        <span>{message}</span>
      </div>
      <button aria-label="Cerrar aviso" onClick={onDismiss} type="button">
        <X size={12} />
      </button>
    </div>
  );
}
