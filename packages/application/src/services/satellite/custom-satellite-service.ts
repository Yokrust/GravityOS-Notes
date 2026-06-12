import {
  createCustomSatelliteInstance,
  createCustomSatelliteType,
  updateCustomSatelliteInstanceValue,
  validateCustomSatelliteProposal,
  type CustomSatelliteProposal,
  type SatelliteValue
} from "@gravity/domain";

import type {
  ClockPort,
  CustomSatelliteFrameUpdate,
  CustomSatelliteGeneratorPort,
  CustomSatelliteImageAsset,
  CustomSatelliteState,
  IdGeneratorPort,
  PersistencePort
} from "../../contracts/index.js";

export class CustomSatelliteService {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly persistence: PersistencePort,
    private readonly generator: CustomSatelliteGeneratorPort
  ) {}

  async hydrate(): Promise<CustomSatelliteState> {
    const state = await this.persistence.loadState();
    return {
      customTypes: state.customSatelliteTypes,
      instances: state.customSatelliteInstances
    };
  }

  async generate(description: string): Promise<CustomSatelliteProposal> {
    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      throw new Error("Describe what the Satellite should help you do.");
    }
    if (normalizedDescription.length > 500) {
      throw new Error(
        "Satellite descriptions must be 500 characters or fewer."
      );
    }

    return validateCustomSatelliteProposal(
      await this.generator.generate(normalizedDescription)
    );
  }

  async confirm(
    proposal: CustomSatelliteProposal
  ): Promise<CustomSatelliteState> {
    const customType = createCustomSatelliteType({
      id: this.ids.next("custom-satellite-type"),
      ids: this.ids,
      now: this.clock.now(),
      proposal
    });

    await this.persistence.saveCustomSatelliteType(customType);
    return this.hydrate();
  }

  async createInstance(input: {
    customTypeId: string;
    x?: number;
    y?: number;
    z?: number;
  }): Promise<CustomSatelliteState> {
    const state = await this.hydrate();
    const customType = requireCustomType(state, input.customTypeId);
    const instance = createCustomSatelliteInstance({
      customType,
      id: this.ids.next("custom-satellite-instance"),
      now: this.clock.now(),
      ...(input.x === undefined &&
      input.y === undefined &&
      input.z === undefined
        ? {}
        : {
            position: {
              x: input.x ?? 24,
              y: input.y ?? 24,
              z: input.z ?? 1
            }
          })
    });

    await this.persistence.saveCustomSatelliteInstance(instance);
    return this.hydrate();
  }

  async updateInstanceValue(input: {
    instanceId: string;
    key: string;
    value: SatelliteValue;
  }): Promise<void> {
    const state = await this.hydrate();
    const instance = requireInstance(state, input.instanceId);
    const customType = requireCustomType(state, instance.customTypeId);
    const property = customType.properties.find(
      (candidate) => candidate.key === input.key
    );
    if (property?.valueType === "image" && input.value !== null) {
      throw new Error(
        "Satellite images must be saved through the image upload."
      );
    }
    const updated = updateCustomSatelliteInstanceValue({
      customType,
      instance,
      key: input.key,
      value: input.value,
      now: this.clock.now()
    });

    await this.persistence.updateCustomSatelliteInstanceValue({
      instanceId: updated.id,
      key: input.key,
      updatedAt: updated.updatedAt,
      value: updated.data[input.key]!
    });
  }

  async updateInstanceFrame(input: {
    instanceId: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    z?: number;
  }): Promise<void> {
    const state = await this.hydrate();
    const instance = requireInstance(state, input.instanceId);
    const frameUpdate: CustomSatelliteFrameUpdate = {
      instanceId: instance.id,
      updatedAt: this.clock.now(),
      ...(input.x === undefined ? {} : { x: finiteNumber(input.x, "x") }),
      ...(input.y === undefined ? {} : { y: finiteNumber(input.y, "y") }),
      ...(input.width === undefined
        ? {}
        : { width: boundedNumber(input.width, "width", 280, 640) }),
      ...(input.height === undefined
        ? {}
        : { height: boundedNumber(input.height, "height", 240, 760) }),
      ...(input.z === undefined ? {} : { z: finiteNumber(input.z, "z") })
    };
    if (!hasFrameChanges(frameUpdate)) {
      throw new Error("Satellite frame update must include a changed value.");
    }

    await this.persistence.updateCustomSatelliteInstanceFrame(frameUpdate);
  }

  async saveInstanceImage(input: {
    bytes: Uint8Array;
    instanceId: string;
    key: string;
    mimeType: string;
  }): Promise<{ imageId: string }> {
    const state = await this.hydrate();
    const instance = requireInstance(state, input.instanceId);
    const customType = requireCustomType(state, instance.customTypeId);
    const property = customType.properties.find(
      (candidate) => candidate.key === input.key
    );
    if (!property || property.valueType !== "image") {
      throw new Error(`Unknown Satellite image property: ${input.key}`);
    }

    const imageId = this.ids.next("custom-satellite-image");
    await this.persistence.saveCustomSatelliteImageValue({
      bytes: input.bytes,
      imageId,
      instanceId: instance.id,
      key: property.key,
      mimeType: input.mimeType,
      updatedAt: this.clock.now()
    });
    return { imageId };
  }

  async loadImage(imageId: string): Promise<CustomSatelliteImageAsset> {
    const asset = await this.persistence.loadCustomSatelliteImage(imageId);
    if (!asset) {
      throw new Error(`Unknown Custom Satellite image: ${imageId}`);
    }
    return asset;
  }

  async closeInstance(instanceId: string): Promise<void> {
    await this.setInstanceVisibility(instanceId, false);
  }

  async reopenInstance(instanceId: string): Promise<void> {
    await this.setInstanceVisibility(instanceId, true);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    const state = await this.hydrate();
    requireInstance(state, instanceId);
    await this.persistence.deleteCustomSatelliteInstance(instanceId);
  }

  private async setInstanceVisibility(
    instanceId: string,
    isOpen: boolean
  ): Promise<void> {
    const state = await this.hydrate();
    const instance = requireInstance(state, instanceId);
    await this.persistence.updateCustomSatelliteInstanceVisibility({
      instanceId: instance.id,
      isOpen,
      updatedAt: this.clock.now()
    });
  }
}

function requireCustomType(state: CustomSatelliteState, customTypeId: string) {
  const customType = state.customTypes.find(
    (candidate) => candidate.id === customTypeId
  );
  if (!customType) {
    throw new Error(`Unknown Custom Satellite Type: ${customTypeId}`);
  }
  return customType;
}

function requireInstance(state: CustomSatelliteState, instanceId: string) {
  const instance = state.instances.find(
    (candidate) => candidate.id === instanceId
  );
  if (!instance) {
    throw new Error(`Unknown Satellite Instance: ${instanceId}`);
  }
  return instance;
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Satellite ${label} must be finite.`);
  }
  return value;
}

function boundedNumber(
  value: number,
  label: string,
  minimum: number,
  maximum: number
): number {
  const finite = finiteNumber(value, label);
  if (finite < minimum || finite > maximum) {
    throw new Error(
      `Satellite ${label} must be between ${minimum} and ${maximum}.`
    );
  }
  return finite;
}

function hasFrameChanges(update: CustomSatelliteFrameUpdate): boolean {
  return (
    update.x !== undefined ||
    update.y !== undefined ||
    update.width !== undefined ||
    update.height !== undefined ||
    update.z !== undefined
  );
}
