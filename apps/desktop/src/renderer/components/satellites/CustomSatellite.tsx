import type { CustomSatellite as CustomSatelliteRecord } from "@/lib/types";
import { useStore } from "@/lib/store";

import { SatelliteShell } from "./SatelliteShell";
import { CustomSatelliteFields } from "./CustomSatelliteFields";
import {
  CustomSatelliteIconView,
  customSatelliteColors
} from "./custom-satellite-visuals";

export function CustomSatellite({ sat }: { sat: CustomSatelliteRecord }) {
  const {
    customSatelliteTypes,
    closeSatellite,
    setCustomSatelliteValue,
    commitCustomSatelliteValue
  } = useStore();
  const customType = customSatelliteTypes.find(
    (candidate) => candidate.id === sat.customTypeId
  );

  if (!customType) {
    return null;
  }

  const color = customSatelliteColors[customType.color];
  return (
    <SatelliteShell
      onClose={() => {
        if (
          window.confirm(
            "¿Eliminar esta instancia y todos los datos que contiene?"
          )
        ) {
          closeSatellite(sat.id);
        }
      }}
      resizable
      sat={sat}
      title={customType.name}
      leftSlot={
        <span
          className="sat-icon-btn"
          data-active="true"
          style={{ color: color.accent, background: color.soft }}
        >
          <CustomSatelliteIconView icon={customType.icon} size={13} />
        </span>
      }
    >
      <div
        className="custom-satellite-card"
        style={{ "--custom-accent": color.accent } as React.CSSProperties}
      >
        {customType.description ? (
          <p className="custom-satellite-description">
            {customType.description}
          </p>
        ) : null}
        <CustomSatelliteFields
          data={sat.data}
          properties={customType.properties}
          onChange={(key, value) => setCustomSatelliteValue(sat.id, key, value)}
          onCommit={(key, value) =>
            void commitCustomSatelliteValue(sat.id, key, value)
          }
        />
      </div>
    </SatelliteShell>
  );
}
