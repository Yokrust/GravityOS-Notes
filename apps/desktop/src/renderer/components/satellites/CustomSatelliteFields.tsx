import type { CustomSatelliteProperty, SatelliteValue } from "@gravity/domain";

interface CustomSatelliteFieldsProps {
  data: Record<string, SatelliteValue>;
  disabled?: boolean;
  onChange?: (key: string, value: SatelliteValue) => void;
  onCommit?: (key: string, value: SatelliteValue) => void;
  properties: CustomSatelliteProperty[];
}

export function CustomSatelliteFields({
  data,
  disabled = false,
  onChange,
  onCommit,
  properties
}: CustomSatelliteFieldsProps) {
  return (
    <div className="custom-satellite-fields">
      {properties.map((property) => (
        <CustomSatelliteField
          key={property.id}
          data={data}
          disabled={disabled}
          {...(onChange === undefined ? {} : { onChange })}
          {...(onCommit === undefined ? {} : { onCommit })}
          property={property}
        />
      ))}
    </div>
  );
}

function CustomSatelliteField({
  data,
  disabled,
  onChange,
  onCommit,
  property
}: {
  data: Record<string, SatelliteValue>;
  disabled: boolean;
  onChange?: (key: string, value: SatelliteValue) => void;
  onCommit?: (key: string, value: SatelliteValue) => void;
  property: CustomSatelliteProperty;
}) {
  const current = data[property.key] ?? property.defaultValue;
  const commit = (value: SatelliteValue) => {
    onChange?.(property.key, value);
    onCommit?.(property.key, value);
  };

  return (
    <label className="custom-satellite-field">
      <span className="custom-satellite-label">
        {property.label}
        {property.required ? <span aria-hidden="true">*</span> : null}
      </span>
      {renderControl(property, current, disabled, onChange, onCommit, commit)}
    </label>
  );
}

function renderControl(
  property: CustomSatelliteProperty,
  current: SatelliteValue | undefined,
  disabled: boolean,
  onChange: CustomSatelliteFieldsProps["onChange"],
  onCommit: CustomSatelliteFieldsProps["onCommit"],
  commit: (value: SatelliteValue) => void
) {
  switch (property.valueType) {
    case "shortText":
      return (
        <input
          disabled={disabled}
          type="text"
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange?.(property.key, event.target.value)}
          onBlur={(event) => onCommit?.(property.key, event.target.value)}
        />
      );
    case "longText":
      return (
        <textarea
          disabled={disabled}
          rows={3}
          value={typeof current === "string" ? current : ""}
          onChange={(event) => onChange?.(property.key, event.target.value)}
          onBlur={(event) => onCommit?.(property.key, event.target.value)}
        />
      );
    case "number":
      return (
        <input
          disabled={disabled}
          type="number"
          value={typeof current === "number" ? current : ""}
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
          value={typeof current === "string" ? current : ""}
          onChange={(event) => commit(event.target.value)}
        />
      );
    case "singleSelect":
      return (
        <select
          disabled={disabled}
          value={typeof current === "string" ? current : ""}
          onChange={(event) => commit(event.target.value)}
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
      const selected = Array.isArray(current) ? current : [];
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
                  commit(next);
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
          checked={typeof current === "boolean" ? current : false}
          className="custom-satellite-checkbox"
          disabled={disabled}
          type="checkbox"
          onChange={(event) => commit(event.target.checked)}
        />
      );
    case "progress": {
      const value = typeof current === "number" ? current : 0;
      return (
        <div className="custom-satellite-progress">
          <input
            disabled={disabled}
            max={100}
            min={0}
            type="range"
            value={value}
            onChange={(event) =>
              onChange?.(property.key, event.target.valueAsNumber)
            }
            onMouseUp={(event) =>
              onCommit?.(
                property.key,
                (event.currentTarget as HTMLInputElement).valueAsNumber
              )
            }
            onTouchEnd={(event) =>
              onCommit?.(
                property.key,
                (event.currentTarget as HTMLInputElement).valueAsNumber
              )
            }
            onBlur={(event) =>
              onCommit?.(property.key, event.target.valueAsNumber)
            }
          />
          <span>{value}%</span>
        </div>
      );
    }
    case "image":
      return (
        <div className="custom-satellite-image">
          {isImageValue(current) ? (
            <img alt="" src={current.imageId} />
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
                  commit({ imageId: reader.result });
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
  value: SatelliteValue | undefined
): value is { imageId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "imageId" in value
  );
}
