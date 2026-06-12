import { describe, expect, it } from "vitest";

import { findClosedCustomSatelliteInstance } from "../../src/renderer/lib/custom-satellite-lifecycle.js";

describe("custom satellite lifecycle", () => {
  it("selects the most recently closed instance of a custom type", () => {
    const selected = findClosedCustomSatelliteInstance(
      [
        createInstance({
          id: "older",
          isOpen: false,
          updatedAt: "2026-06-12T12:00:00.000Z"
        }),
        createInstance({
          id: "open",
          isOpen: true,
          updatedAt: "2026-06-12T12:02:00.000Z"
        }),
        createInstance({
          id: "newer",
          isOpen: false,
          updatedAt: "2026-06-12T12:01:00.000Z"
        })
      ],
      "custom-satellite-type-1"
    );

    expect(selected?.id).toBe("newer");
  });

  it("does not recall an instance belonging to another custom type", () => {
    expect(
      findClosedCustomSatelliteInstance(
        [createInstance({ customTypeId: "custom-satellite-type-2" })],
        "custom-satellite-type-1"
      )
    ).toBeNull();
  });
});

function createInstance(
  input: Partial<CustomSatelliteInstanceRecord> = {}
): CustomSatelliteInstanceRecord {
  return {
    createdAt: "2026-06-12T12:00:00.000Z",
    customTypeId: "custom-satellite-type-1",
    data: { title: "Persisted" },
    height: 420,
    id: "custom-satellite-instance-1",
    isOpen: false,
    updatedAt: "2026-06-12T12:00:00.000Z",
    width: 320,
    x: 24,
    y: 24,
    z: 1,
    ...input
  };
}
