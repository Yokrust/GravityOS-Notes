import { describe, expect, it } from "vitest";

import { createPrefixedIdGenerator } from "../../src/main/infrastructure/id-generator.js";

describe("desktop id generator", () => {
  it("creates durable ids with the requested prefix and a UUID suffix", () => {
    const ids = createPrefixedIdGenerator({
      randomUuid: () => "123e4567-e89b-12d3-a456-426614174000"
    });

    expect(ids.next("thread")).toBe(
      "thread-123e4567-e89b-12d3-a456-426614174000"
    );
  });

  it("does not reuse sequential ids across generator instances", () => {
    let next = 0;
    const uuids = [
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174001"
    ];
    const createIds = () =>
      createPrefixedIdGenerator({
        randomUuid: () =>
          uuids[next++] ?? "123e4567-e89b-12d3-a456-426614174999"
      });

    expect(createIds().next("run")).toBe(
      "run-123e4567-e89b-12d3-a456-426614174000"
    );
    expect(createIds().next("run")).toBe(
      "run-123e4567-e89b-12d3-a456-426614174001"
    );
  });

  it("rejects blank prefixes", () => {
    const ids = createPrefixedIdGenerator();

    expect(() => ids.next("   ")).toThrow("ID prefix is required.");
  });
});
