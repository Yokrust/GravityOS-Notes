import { describe, expect, it } from "vitest";

import {
  AppearancePreferencesService,
  DEFAULT_APPEARANCE_PREFERENCES
} from "../src/index.js";
import { createInMemoryPersistence } from "../../testkit/src/index.js";

describe("appearance preferences service", () => {
  it("hydrates defaults when no appearance preferences are persisted", async () => {
    const service = new AppearancePreferencesService(
      createInMemoryPersistence()
    );

    await expect(service.hydrate()).resolves.toEqual(
      DEFAULT_APPEARANCE_PREFERENCES
    );
  });

  it("normalizes and persists theme preferences", async () => {
    const persistence = createInMemoryPersistence();
    const service = new AppearancePreferencesService(persistence);

    await expect(
      service.save({
        harmony: "floating",
        opacity: 4,
        points: [
          { x: 2, y: 0 },
          { x: -0.2, y: 0.5 },
          { x: "invalid", y: 0 }
        ],
        rotation: -240,
        scheme: "light",
        texture: -1
      })
    ).resolves.toEqual({
      harmony: "floating",
      opacity: 1,
      points: [
        { x: 1, y: 0 },
        { x: -0.2, y: 0.5 }
      ],
      rotation: -180,
      scheme: "light",
      texture: 0,
      version: 1
    });

    await expect(service.hydrate()).resolves.toMatchObject({
      harmony: "floating",
      scheme: "light"
    });
  });
});
