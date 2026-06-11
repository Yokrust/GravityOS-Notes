import {
  createCustomSatelliteInstance,
  createCustomSatelliteType,
  updateCustomSatelliteInstanceValue,
  validateCustomSatelliteProposal,
  type CustomSatelliteInstance,
  type CustomSatelliteProposal,
  type CustomSatelliteType,
  type SatelliteValue
} from "@gravity/domain";

import type {
  ClockPort,
  CustomSatelliteGeneratorPort,
  IdGeneratorPort,
  PersistencePort
} from "../../contracts/index.js";

export interface CustomSatelliteState {
  customTypes: CustomSatelliteType[];
  instances: CustomSatelliteInstance[];
}

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
  }): Promise<CustomSatelliteState> {
    const state = await this.hydrate();
    const instance = requireInstance(state, input.instanceId);
    const customType = requireCustomType(state, instance.customTypeId);
    const updated = updateCustomSatelliteInstanceValue({
      customType,
      instance,
      key: input.key,
      value: input.value,
      now: this.clock.now()
    });
    await this.persistence.saveCustomSatelliteInstance(updated);
    return this.hydrate();
  }

  async updateInstanceFrame(input: {
    instanceId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
  }): Promise<CustomSatelliteState> {
    const state = await this.hydrate();
    const instance = requireInstance(state, input.instanceId);
    const updated = {
      ...instance,
      x: finiteNumber(input.x, "x"),
      y: finiteNumber(input.y, "y"),
      width: boundedNumber(input.width, "width", 280, 640),
      height: boundedNumber(input.height, "height", 240, 760),
      z: finiteNumber(input.z, "z"),
      updatedAt: this.clock.now()
    };
    await this.persistence.saveCustomSatelliteInstance(updated);
    return this.hydrate();
  }

  async closeInstance(instanceId: string): Promise<CustomSatelliteState> {
    await this.persistence.deleteCustomSatelliteInstance(instanceId);
    return this.hydrate();
  }
}

function requireCustomType(
  state: CustomSatelliteState,
  customTypeId: string
): CustomSatelliteType {
  const customType = state.customTypes.find(
    (candidate) => candidate.id === customTypeId
  );
  if (!customType) {
    throw new Error(`Unknown Custom Satellite Type: ${customTypeId}`);
  }
  return customType;
}

function requireInstance(
  state: CustomSatelliteState,
  instanceId: string
): CustomSatelliteInstance {
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
