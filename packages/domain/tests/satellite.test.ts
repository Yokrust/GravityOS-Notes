import { describe, expect, it } from "vitest";

import {
  createCustomSatelliteInstance,
  createCustomSatelliteType,
  updateCustomSatelliteInstanceValue,
  validateCustomSatelliteProposal
} from "../src/index.js";

const ids = {
  next(prefix: string) {
    return `${prefix}-1`;
  }
};

const proposal = {
  name: "Character Profile",
  description: "Track a fictional character.",
  icon: "user-round" as const,
  color: "violet" as const,
  appearance: "card" as const,
  properties: [
    {
      key: "character_name",
      label: "Character name",
      valueType: "shortText" as const,
      required: true
    },
    {
      key: "status",
      label: "Status",
      valueType: "singleSelect" as const,
      required: false,
      options: ["Draft", "Final"],
      defaultValue: "Draft"
    }
  ]
};

describe("custom satellite domain", () => {
  it("normalizes and validates an AI proposal", () => {
    expect(
      validateCustomSatelliteProposal({
        ...proposal,
        name: "  Character Profile  ",
        properties: [
          proposal.properties[0],
          {
            ...proposal.properties[1],
            options: ["Draft", "Final", "Draft"]
          }
        ]
      })
    ).toMatchObject({
      name: "Character Profile",
      properties: [{ key: "character_name" }, { options: ["Draft", "Final"] }]
    });
  });

  it("rejects duplicate keys and values outside the closed schema", () => {
    expect(() =>
      validateCustomSatelliteProposal({
        ...proposal,
        properties: [proposal.properties[0], proposal.properties[0]]
      })
    ).toThrow("Duplicate Satellite property key");

    expect(() =>
      validateCustomSatelliteProposal({
        ...proposal,
        properties: [
          {
            key: "progress",
            label: "Progress",
            valueType: "progress",
            required: false,
            defaultValue: 101
          }
        ]
      })
    ).toThrow("Invalid value");

    expect(() =>
      validateCustomSatelliteProposal({
        ...proposal,
        properties: [
          {
            key: "due_date",
            label: "Due date",
            valueType: "date",
            required: false,
            defaultValue: "2026-02-30"
          }
        ]
      })
    ).toThrow("Invalid value");
  });

  it("creates independent instances with cloned defaults", () => {
    const customType = createCustomSatelliteType({
      id: "custom-type-1",
      ids,
      now: "2026-06-11T10:00:00.000Z",
      proposal
    });
    const first = createCustomSatelliteInstance({
      customType,
      id: "instance-1",
      now: "2026-06-11T10:01:00.000Z"
    });
    const second = createCustomSatelliteInstance({
      customType,
      id: "instance-2",
      now: "2026-06-11T10:02:00.000Z"
    });

    expect(first.data).toEqual({ status: "Draft" });
    expect(second.data).toEqual({ status: "Draft" });
    expect(first.id).not.toBe(second.id);
  });

  it("updates only values declared by the referenced type", () => {
    const customType = createCustomSatelliteType({
      id: "custom-type-1",
      ids,
      now: "2026-06-11T10:00:00.000Z",
      proposal
    });
    const instance = createCustomSatelliteInstance({
      customType,
      id: "instance-1",
      now: "2026-06-11T10:01:00.000Z"
    });

    const updated = updateCustomSatelliteInstanceValue({
      customType,
      instance,
      key: "status",
      value: "Final",
      now: "2026-06-11T10:02:00.000Z"
    });

    expect(updated.data).toEqual({ status: "Final" });
    expect(() =>
      updateCustomSatelliteInstanceValue({
        customType,
        instance,
        key: "missing",
        value: "nope",
        now: "2026-06-11T10:02:00.000Z"
      })
    ).toThrow("Unknown Satellite property");
  });
});
