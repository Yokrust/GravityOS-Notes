import { useEffect, useState } from "react";

export function CustomSatelliteFields({
  data,
  disabled = false,
  onChange,
  onCommit,
  onImageUpload,
  properties
}: {
  data: Record<string, SatelliteValueRecord>;
  disabled?: boolean;
  onChange?: (key: string, value: SatelliteValueRecord) => void;
  onCommit?: (key: string, value: SatelliteValueRecord) => void;
  onImageUpload?: (key: string, file: File) => Promise<void>;
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
          {...(onImageUpload === undefined ? {} : { onImageUpload })}
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
  onImageUpload,
  property
}: {
  data: Record<string, SatelliteValueRecord>;
  disabled: boolean;
  onChange?: (key: string, value: SatelliteValueRecord) => void;
  onCommit?: (key: string, value: SatelliteValueRecord) => void;
  onImageUpload?: (key: string, file: File) => Promise<void>;
  property: CustomSatellitePropertyRecord;
}) {
  const value = Object.hasOwn(data, property.key)
    ? data[property.key]
    : (property.defaultValue ?? null);
  const isUnset = isSatelliteFieldUnset(property, value);
  const isInvalid = !disabled && property.required && isUnset;
  const apply = (next: SatelliteValueRecord) => {
    onChange?.(property.key, next);
    onCommit?.(property.key, next);
  };
  const canClear =
    !disabled &&
    !property.required &&
    !isUnset &&
    (onChange !== undefined || onCommit !== undefined);

  return (
    <div className={`custom-satellite-field${isInvalid ? " is-invalid" : ""}`}>
      <div className="custom-satellite-label">
        <span>
          {property.label}
          {property.required ? <span aria-hidden="true">*</span> : null}
        </span>
        {canClear ? (
          <button
            aria-label={`Limpiar ${property.label}`}
            onClick={() => apply(null)}
            type="button"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      {renderInput(
        property,
        value,
        disabled,
        isInvalid,
        onChange,
        onCommit,
        onImageUpload,
        apply
      )}
      {isInvalid ? (
        <span className="custom-satellite-required" role="status">
          Requerido
        </span>
      ) : null}
    </div>
  );
}

function renderInput(
  property: CustomSatellitePropertyRecord,
  value: SatelliteValueRecord | undefined,
  disabled: boolean,
  isInvalid: boolean,
  onChange: ((key: string, value: SatelliteValueRecord) => void) | undefined,
  onCommit: ((key: string, value: SatelliteValueRecord) => void) | undefined,
  onImageUpload: ((key: string, file: File) => Promise<void>) | undefined,
  apply: (value: SatelliteValueRecord) => void
) {
  const common = {
    "aria-invalid": isInvalid,
    "aria-label": property.label,
    disabled,
    required: property.required
  } as const;

  switch (property.valueType) {
    case "shortText":
      return (
        <input
          {...common}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange?.(
              property.key,
              event.target.value === "" ? null : event.target.value
            )
          }
          onBlur={(event) =>
            onCommit?.(
              property.key,
              event.target.value.trim() ? event.target.value : null
            )
          }
        />
      );
    case "longText":
      return (
        <textarea
          {...common}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            onChange?.(
              property.key,
              event.target.value === "" ? null : event.target.value
            )
          }
          onBlur={(event) =>
            onCommit?.(
              property.key,
              event.target.value.trim() ? event.target.value : null
            )
          }
        />
      );
    case "number":
      return (
        <input
          {...common}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange?.(
              property.key,
              event.target.value === "" ? null : event.target.valueAsNumber
            )
          }
          onBlur={(event) =>
            onCommit?.(
              property.key,
              event.target.value === "" ? null : event.target.valueAsNumber
            )
          }
        />
      );
    case "date":
      return (
        <input
          {...common}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            apply(event.target.value === "" ? null : event.target.value)
          }
        />
      );
    case "singleSelect":
      return (
        <select
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(event) =>
            apply(event.target.value === "" ? null : event.target.value)
          }
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
        <div
          aria-invalid={isInvalid}
          aria-label={property.label}
          className="custom-satellite-options"
          role="group"
        >
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
                  apply(next.length === 0 ? null : next);
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
          {...common}
          checked={typeof value === "boolean" ? value : false}
          className="custom-satellite-checkbox"
          type="checkbox"
          onChange={(event) => apply(event.target.checked)}
        />
      );
    case "progress": {
      const progress = typeof value === "number" ? value : 0;
      return (
        <div className="custom-satellite-progress">
          <input
            {...common}
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
          <span>{value === null ? "Sin valor" : `${progress}%`}</span>
        </div>
      );
    }
    case "image":
      return (
        <CustomSatelliteImageField
          disabled={disabled}
          isInvalid={isInvalid}
          label={property.label}
          {...(onImageUpload
            ? { onUpload: (file: File) => onImageUpload(property.key, file) }
            : {})}
          value={value}
        />
      );
  }
}

function CustomSatelliteImageField({
  disabled,
  isInvalid,
  label,
  onUpload,
  value
}: {
  disabled: boolean;
  isInvalid: boolean;
  label: string;
  onUpload?: (file: File) => Promise<void>;
  value: SatelliteValueRecord | undefined;
}) {
  const imageId = isImageValue(value) ? value.imageId : null;
  const [source, setSource] = useState<string | null>(() =>
    imageId?.startsWith("data:") ? imageId : null
  );

  useEffect(() => {
    if (!imageId) {
      setSource(null);
      return;
    }
    if (imageId.startsWith("data:")) {
      setSource(imageId);
      return;
    }
    const load = window.gravity?.loadCustomSatelliteImage;
    if (!load) {
      setSource(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    void load(imageId)
      .then((asset) => {
        if (cancelled) return;
        const bytes = new Uint8Array(asset.bytes.byteLength);
        bytes.set(asset.bytes);
        objectUrl = URL.createObjectURL(
          new Blob([bytes.buffer], { type: asset.mimeType })
        );
        setSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSource(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  return (
    <div
      aria-invalid={isInvalid}
      aria-label={label}
      className="custom-satellite-image"
      role="group"
    >
      {source ? (
        <img alt="" src={source} />
      ) : (
        <div className="custom-satellite-image-placeholder">Sin imagen</div>
      )}
      <input
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={disabled || !onUpload}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !onUpload) return;
          void onUpload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function isSatelliteFieldUnset(
  property: CustomSatellitePropertyRecord,
  value: SatelliteValueRecord | undefined
): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  switch (property.valueType) {
    case "shortText":
    case "longText":
    case "date":
    case "singleSelect":
      return typeof value === "string" && !value.trim();
    case "multiSelect":
      return Array.isArray(value) && value.length === 0;
    case "image":
      return isImageValue(value) && !value.imageId.trim();
    case "number":
    case "progress":
    case "checkbox":
      return false;
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
