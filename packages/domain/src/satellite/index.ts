export const SATELLITE_VALUE_TYPES = [
  "shortText",
  "longText",
  "number",
  "date",
  "singleSelect",
  "multiSelect",
  "checkbox",
  "progress",
  "image"
] as const;

export type SatelliteValueType = (typeof SATELLITE_VALUE_TYPES)[number];

export const CUSTOM_SATELLITE_ICONS = [
  "sparkles",
  "list-checks",
  "user-round",
  "briefcase",
  "book-open",
  "shirt",
  "heart",
  "star",
  "calendar-days",
  "image"
] as const;

export type CustomSatelliteIcon = (typeof CUSTOM_SATELLITE_ICONS)[number];

export const CUSTOM_SATELLITE_COLORS = [
  "slate",
  "amber",
  "rose",
  "sky",
  "emerald",
  "violet"
] as const;

export type CustomSatelliteColor = (typeof CUSTOM_SATELLITE_COLORS)[number];

export type SatelliteValue =
  | string
  | number
  | boolean
  | string[]
  | { imageId: string };

export interface CustomSatellitePropertyProposal {
  key: string;
  label: string;
  valueType: SatelliteValueType;
  required: boolean;
  options?: string[];
  defaultValue?: SatelliteValue;
}

export interface CustomSatelliteProposal {
  name: string;
  description?: string;
  icon: CustomSatelliteIcon;
  color: CustomSatelliteColor;
  appearance: "card";
  properties: CustomSatellitePropertyProposal[];
}

export interface CustomSatelliteProperty extends CustomSatellitePropertyProposal {
  id: string;
}

export interface CustomSatelliteType {
  id: string;
  name: string;
  description?: string;
  icon: CustomSatelliteIcon;
  color: CustomSatelliteColor;
  appearance: "card";
  properties: CustomSatelliteProperty[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomSatelliteInstance {
  id: string;
  customTypeId: string;
  data: Record<string, SatelliteValue>;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  createdAt: string;
  updatedAt: string;
}

export interface DomainIdGenerator {
  next(prefix: string): string;
}

export const CUSTOM_SATELLITE_LIMITS = {
  descriptionLength: 200,
  nameLength: 50,
  optionCount: 10,
  optionLength: 40,
  propertyCount: 12,
  propertyLabelLength: 50
} as const;

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCustomSatelliteProposal(
  input: CustomSatelliteProposal
): CustomSatelliteProposal {
  const name = requireTrimmedText(
    input.name,
    "Satellite name",
    CUSTOM_SATELLITE_LIMITS.nameLength
  );
  const description = normalizeOptionalText(
    input.description,
    "Satellite description",
    CUSTOM_SATELLITE_LIMITS.descriptionLength
  );

  if (!CUSTOM_SATELLITE_ICONS.includes(input.icon)) {
    throw new Error(`Unsupported Satellite icon: ${input.icon}`);
  }

  if (!CUSTOM_SATELLITE_COLORS.includes(input.color)) {
    throw new Error(`Unsupported Satellite color: ${input.color}`);
  }

  for (const property of input.properties) {
    if (!SATELLITE_VALUE_TYPES.includes(property.valueType)) {
      throw new Error(
        `Unsupported Satellite value type: ${String(property.valueType)}`
      );
    }
  }

  if (input.appearance !== "card") {
    throw new Error("Custom Satellites must use the card appearance.");
  }

  if (
    input.properties.length === 0 ||
    input.properties.length > CUSTOM_SATELLITE_LIMITS.propertyCount
  ) {
    throw new Error(
      `Custom Satellites require between 1 and ${CUSTOM_SATELLITE_LIMITS.propertyCount} properties.`
    );
  }

  const keys = new Set<string>();
  const properties = input.properties.map((property) => {
    const key = property.key.trim();
    if (!SAFE_KEY.test(key)) {
      throw new Error(`Invalid Satellite property key: ${property.key}`);
    }
    if (keys.has(key)) {
      throw new Error(`Duplicate Satellite property key: ${key}`);
    }
    keys.add(key);

    const label = requireTrimmedText(
      property.label,
      "Satellite property label",
      CUSTOM_SATELLITE_LIMITS.propertyLabelLength
    );
    const options = normalizeOptions(property.valueType, property.options);
    const defaultValue =
      property.defaultValue === undefined
        ? undefined
        : validateSatelliteValue(property, property.defaultValue);

    return {
      key,
      label,
      valueType: property.valueType,
      required: property.required,
      ...(options === undefined ? {} : { options }),
      ...(defaultValue === undefined ? {} : { defaultValue })
    };
  });

  return {
    name,
    ...(description === undefined ? {} : { description }),
    icon: input.icon,
    color: input.color,
    appearance: "card",
    properties
  };
}

export function createCustomSatelliteType(input: {
  id: string;
  ids: DomainIdGenerator;
  now: string;
  proposal: CustomSatelliteProposal;
}): CustomSatelliteType {
  const proposal = validateCustomSatelliteProposal(input.proposal);

  return {
    id: requireIdentifier(input.id, "Custom Satellite Type id"),
    name: proposal.name,
    ...(proposal.description === undefined
      ? {}
      : { description: proposal.description }),
    icon: proposal.icon,
    color: proposal.color,
    appearance: "card",
    properties: proposal.properties.map((property) => ({
      id: input.ids.next("satellite-property"),
      ...property
    })),
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function createCustomSatelliteInstance(input: {
  customType: CustomSatelliteType;
  id: string;
  now: string;
  position?: { x: number; y: number; z: number };
}): CustomSatelliteInstance {
  const data = Object.fromEntries(
    input.customType.properties.flatMap((property) =>
      property.defaultValue === undefined
        ? []
        : [[property.key, cloneSatelliteValue(property.defaultValue)]]
    )
  );

  return {
    id: requireIdentifier(input.id, "Satellite Instance id"),
    customTypeId: input.customType.id,
    data,
    x: input.position?.x ?? 24,
    y: input.position?.y ?? 24,
    width: 320,
    height: 420,
    z: input.position?.z ?? 1,
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function updateCustomSatelliteInstanceValue(input: {
  customType: CustomSatelliteType;
  instance: CustomSatelliteInstance;
  key: string;
  now: string;
  value: SatelliteValue;
}): CustomSatelliteInstance {
  if (input.instance.customTypeId !== input.customType.id) {
    throw new Error(
      "Satellite Instance does not match its Custom Satellite Type."
    );
  }

  const property = input.customType.properties.find(
    (candidate) => candidate.key === input.key
  );
  if (!property) {
    throw new Error(`Unknown Satellite property: ${input.key}`);
  }

  const value = validateSatelliteValue(property, input.value);

  return {
    ...input.instance,
    data: {
      ...input.instance.data,
      [property.key]: cloneSatelliteValue(value)
    },
    updatedAt: input.now
  };
}

export function validateSatelliteValue(
  property: CustomSatellitePropertyProposal,
  value: SatelliteValue
): SatelliteValue {
  switch (property.valueType) {
    case "shortText":
    case "longText":
      if (typeof value !== "string") {
        throw invalidValue(property.key);
      }
      return value;
    case "date":
      if (
        typeof value !== "string" ||
        !ISO_DATE.test(value) ||
        !isValidIsoDate(value)
      ) {
        throw invalidValue(property.key);
      }
      return value;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw invalidValue(property.key);
      }
      return value;
    case "progress":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100
      ) {
        throw invalidValue(property.key);
      }
      return value;
    case "checkbox":
      if (typeof value !== "boolean") {
        throw invalidValue(property.key);
      }
      return value;
    case "singleSelect":
      if (typeof value !== "string" || !property.options?.includes(value)) {
        throw invalidValue(property.key);
      }
      return value;
    case "multiSelect":
      if (
        !Array.isArray(value) ||
        value.some(
          (entry) =>
            typeof entry !== "string" || !property.options?.includes(entry)
        )
      ) {
        throw invalidValue(property.key);
      }
      return [...new Set(value)];
    case "image":
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        !("imageId" in value) ||
        typeof value.imageId !== "string" ||
        !value.imageId.trim()
      ) {
        throw invalidValue(property.key);
      }
      return { imageId: value.imageId.trim() };
  }
}

function normalizeOptions(
  valueType: SatelliteValueType,
  rawOptions: string[] | undefined
): string[] | undefined {
  const requiresOptions =
    valueType === "singleSelect" || valueType === "multiSelect";

  if (!requiresOptions) {
    if (rawOptions !== undefined) {
      throw new Error(`Options are not supported for ${valueType}.`);
    }
    return undefined;
  }

  const options = (rawOptions ?? []).map((option) =>
    requireTrimmedText(
      option,
      "Satellite option",
      CUSTOM_SATELLITE_LIMITS.optionLength
    )
  );
  const uniqueOptions = [...new Set(options)];

  if (
    uniqueOptions.length === 0 ||
    uniqueOptions.length > CUSTOM_SATELLITE_LIMITS.optionCount
  ) {
    throw new Error(
      `Select properties require between 1 and ${CUSTOM_SATELLITE_LIMITS.optionCount} unique options.`
    );
  }

  return uniqueOptions;
}

function normalizeOptionalText(
  value: string | undefined,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined || !value.trim()) {
    return undefined;
  }
  return requireTrimmedText(value, label, maxLength);
}

function requireTrimmedText(
  value: string,
  label: string,
  maxLength: number
): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function cloneSatelliteValue(value: SatelliteValue): SatelliteValue {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (typeof value === "object" && value !== null) {
    return { ...value };
  }
  return value;
}

function invalidValue(key: string): Error {
  return new Error(`Invalid value for Satellite property: ${key}`);
}

function isValidIsoDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
