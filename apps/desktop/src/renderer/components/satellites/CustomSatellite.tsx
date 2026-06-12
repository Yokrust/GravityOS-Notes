"use client";

import { Trash2 } from "lucide-react";

import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import {
  CUSTOM_SATELLITE_COLORS,
  CustomSatelliteIcon
} from "@/lib/satellite-visuals";
import type { CustomSatellite } from "@/lib/types";
import { CustomSatelliteErrorNotice } from "../CustomSatelliteErrorNotice";
import { CustomSatelliteFields } from "./CustomSatelliteFields";

export function CustomSatelliteCard({ sat }: { sat: CustomSatellite }) {
  const {
    customSatelliteTypes,
    customSatelliteError,
    clearCustomSatelliteError,
    closeSatellite,
    deleteCustomSatellite,
    saveCustomSatelliteImage,
    setCustomSatelliteValue,
    commitCustomSatelliteValue
  } = useStore();
  const customType = customSatelliteTypes.find(
    (candidate) => candidate.id === sat.customTypeId
  );
  if (!customType) return null;

  const palette = CUSTOM_SATELLITE_COLORS[customType.color];

  return (
    <SatelliteShell
      onClose={() => closeSatellite(sat.id)}
      resizable
      sat={sat}
      title={customType.name}
      leftSlot={
        <>
          <span
            className="sat-icon-btn"
            data-active="true"
            style={{ color: palette.accent, background: palette.soft }}
          >
            <CustomSatelliteIcon icon={customType.icon} size={13} />
          </span>
          <button
            aria-label={`Eliminar ${customType.name}`}
            className="sat-icon-btn"
            onClick={() => {
              if (
                window.confirm(
                  "¿Eliminar permanentemente esta instancia y todos sus datos?"
                )
              ) {
                void deleteCustomSatellite(sat.id);
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            title="Eliminar Satellite"
            type="button"
          >
            <Trash2 size={12} strokeWidth={1.7} />
          </button>
        </>
      }
    >
      <div
        className="custom-satellite-card scroll-thin"
        style={{ "--custom-accent": palette.accent } as React.CSSProperties}
      >
        {customSatelliteError?.instanceId === sat.id ? (
          <CustomSatelliteErrorNotice
            message={customSatelliteError.message}
            onDismiss={clearCustomSatelliteError}
          />
        ) : null}
        {customType.description ? (
          <p className="custom-satellite-description">
            {customType.description}
          </p>
        ) : null}
        <CustomSatelliteFields
          data={sat.data}
          properties={customType.properties}
          onChange={(key, value) => setCustomSatelliteValue(sat.id, key, value)}
          onCommit={(key, value) => {
            void commitCustomSatelliteValue(sat.id, key, value);
          }}
          onImageUpload={(key, file) =>
            saveCustomSatelliteImage(sat.id, key, file)
          }
        />
      </div>
    </SatelliteShell>
  );
}
