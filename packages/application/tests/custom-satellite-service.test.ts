import { describe, expect, it } from "vitest";

import { CustomSatelliteService } from "../src/index.js";
import {
  createFixedClock,
  createInMemoryPersistence,
  createSequentialIdGenerator
} from "../../testkit/src/index.js";

const proposal = {
  name: "Project Card",
  description: "Track one design project.",
  icon: "briefcase" as const,
  color: "sky" as const,
  appearance: "card" as const,
  properties: [
    {
      key: "project_name",
      label: "Project name",
      valueType: "shortText" as const,
      required: true
    },
    {
      key: "progress",
      label: "Progress",
      valueType: "progress" as const,
      required: false,
      defaultValue: 0
    }
  ]
};

describe("custom satellite service", () => {
  it("generates, confirms, and instantiates a validated proposal", async () => {
    const persistence = createInMemoryPersistence();
    const service = new CustomSatelliteService(
      createFixedClock("2026-06-11T12:00:00.000Z"),
      createSequentialIdGenerator(),
      persistence,
      {
        async generate() {
          return proposal;
        }
      }
    );

    await expect(service.generate("Track my project")).resolves.toEqual(
      proposal
    );
    const confirmed = await service.confirm(proposal);
    const customType = confirmed.customTypes[0];
    expect(customType).toMatchObject({
      id: "custom-satellite-type-1",
      name: "Project Card"
    });

    const created = await service.createInstance({
      customTypeId: customType!.id,
      x: 80,
      y: 120,
      z: 12
    });
    expect(created.instances[0]).toMatchObject({
      customTypeId: customType!.id,
      data: { progress: 0 },
      x: 80,
      y: 120,
      z: 12
    });
  });

  it("validates instance values before persistence", async () => {
    const persistence = createInMemoryPersistence();
    const service = new CustomSatelliteService(
      createFixedClock("2026-06-11T12:00:00.000Z"),
      createSequentialIdGenerator(),
      persistence,
      {
        async generate() {
          return proposal;
        }
      }
    );
    const confirmed = await service.confirm(proposal);
    const created = await service.createInstance({
      customTypeId: confirmed.customTypes[0]!.id
    });

    await expect(
      service.updateInstanceValue({
        instanceId: created.instances[0]!.id,
        key: "progress",
        value: 75
      })
    ).resolves.toMatchObject({
      instances: [{ data: { progress: 75 } }]
    });

    await expect(
      service.updateInstanceValue({
        instanceId: created.instances[0]!.id,
        key: "progress",
        value: 101
      })
    ).rejects.toThrow("Invalid value");
  });
});
