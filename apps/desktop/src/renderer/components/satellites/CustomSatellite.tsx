"use client";

import { SatelliteShell } from "./SatelliteShell";
import { useStore } from "@/lib/store";
import {
  CUSTOM_SATELLITE_COLORS,
  CustomSatelliteIcon
} from "@/lib/satellite-visuals";
import type { CustomSatellite } from "@/lib/types";

export function CustomSatelliteFields({
  data,
  disabled = false,
  onChange,
  onCommit,
  properties
}: {
  data: Record<string, SatelliteValueRecord>;
  disabled?: boolean;
  onChange?: (key: string, value: SatelliteValueRecord) => void;
  onCommit?: (key: string, value: SatelliteValueRecord) => void;
  properties: CustomSatellitePropertyRecord[];
}) {
  return (
    <div className="custom-satellite-fields">
      {properties.map((property) => (
        <FieldRow
          data={data}
          disabled={disabled}
          key={property.id}
          {...(onChange === undefined ? {} : { onChange })}
          {...(onCommit === undefined ? {} : { onCommit })}
          property={property}
        />
      ))}
    </div>
  );
}

function FieldRow({
  data,
  disabled,
  onChange,
  onCommit,
  property
}: {
  data: Record<string, SatelliteValueRecord>;
  disabled: boolean;
  onChange?: (key: string, value: SatelliteValueRecord) => void;
  onCommit?: (key: string, value: SatelliteValueRecord) => void;
  property: CustomSatellitePropertyRecord;
}) {
  const value = data[property.key] ?? property.defaultValue;
  const apply = (next: SatelliteValueRecord) => {
    onChange?.(property.key, next);
    onCommit?.(property.key, next);
  };

  return (
    <label className="custom-satellite-field">
      <span className="custom-satellite-label">
        {property.label}
        {property.required ? <span aria-hidden="true">*</span> : null}
      </span>
      {renderInput(property, value, disabled, onChange, onCommit, apply)}
    </label>
  );
}

function renderInput(
  property: CustomSatellitePropertyRecord,
  value: SatelliteValueRecord | undefined,
  disabled: boolean,
  onChange: ((key: string, value: SatelliteValueRecord) => void) | undefined,
  onCommit: ((key: string, value: SatelliteValueRecord) => void) | undefined,
  apply: (value: SatelliteValueRecord) => void
) {
  switch (property.valueType) {
    case "shortText":
      return (
        <input
          disabled={disabled}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange?.(property.key, event.target.value)}
          onBlur={(event) => onCommit?.(property.key, event.target.value)}
        />
      );
    case "longText":
      return (
        <textarea
          disabled={disabled}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange?.(property.key, event.target.value)}
          onBlur={(event) => onCommit?.(property.key, event.target.value)}
        />
      );
    case "number":
      return (
        <input
          disabled={disabled}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => {
            if (event.target.value !== "") {
              onChange?.(property.key, event.target.valueAsNumber);
            }
          }}
          onBlur={(event) => {
            if (event.target.value !== "") {
              onCommit?.(property.key, event.target.valueAsNumber);
            }
          }}
        />
      );
    case "date":
      return (
        <input
          disabled={disabled}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => apply(event.target.value)}
        />
      );
    case "singleSelect":
      return (
        <select
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => apply(event.target.value)}
        >
          <option value="">Seleccionar</option>
          {property.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "multiSelect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="custom-satellite-options">
          {property.options?.map((option) => (
            <label key={option}>
              <input
                checked={selected.includes(option)}
                disabled={disabled}
                type="checkbox"
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((entry) => entry !== option);
                  apply(next);
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }
    case "checkbox":
      return (
        <input
          checked={typeof value === "boolean" ? value : false}
          className="custom-satellite-checkbox"
          disabled={disabled}
          type="checkbox"
          onChange={(event) => apply(event.target.checked)}
        />
      );
    case "progress": {
      const progress = typeof value === "number" ? value : 0;
      return (
        <div className="custom-satellite-progress">
          <input
            disabled={disabled}
            max={100}
            min={0}
            type="range"
            value={progress}
            onChange={(event) =>
              onChange?.(property.key, event.target.valueAsNumber)
            }
            onMouseUp={(event) =>
              onCommit?.(property.key, event.currentTarget.valueAsNumber)
            }
            onTouchEnd={(event) =>
              onCommit?.(property.key, event.currentTarget.valueAsNumber)
            }
            onBlur={(event) =>
              onCommit?.(property.key, event.target.valueAsNumber)
            }
          />
          <span>{progress}%</span>
        </div>
      );
    }
    case "image":
      return (
        <div className="custom-satellite-image">
          {isImageValue(value) ? (
            <img alt="" src={value.imageId} />
          ) : (
            <div className="custom-satellite-image-placeholder">Sin imagen</div>
          )}
          <input
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={disabled}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                event.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.addEventListener("load", () => {
                if (typeof reader.result === "string") {
                  apply({ imageId: reader.result });
                }
              });
              reader.readAsDataURL(file);
            }}
          />
        </div>
      );
  }
}

function isImageValue(
  value: SatelliteValueRecord | undefined
): value is { imageId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "imageId" in value
  );
}

export function CustomSatelliteCard({ sat }: { sat: CustomSatellite }) {
  const {
    customSatelliteTypes,
    closeSatellite,
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
          style={{ color: palette.accent, background: palette.soft }}
        >
          <CustomSatelliteIcon icon={customType.icon} size={13} />
        </span>
      }
    >
      <div
        className="custom-satellite-card scroll-thin"
        style={{ "--custom-accent": palette.accent } as React.CSSProperties}
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
          onCommit={(key, value) => {
            void commitCustomSatelliteValue(sat.id, key, value);
          }}
        />
      </div>
    </SatelliteShell>
  );
}
