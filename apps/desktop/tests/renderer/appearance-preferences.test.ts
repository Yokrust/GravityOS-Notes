import {
  resolveAppearanceTheme,
  selectAppearanceScheme,
  selectAppearanceTheme
} from "@gravity/application/appearance";
import { describe, expect, it } from "vitest";

import { cloneDefaultAmbientPreferences } from "../../src/renderer/lib/ambient.js";

describe("appearance preference synchronization", () => {
  it("projects a quick-menu theme selection into the Settings scheme", () => {
    const preferences = selectAppearanceTheme(
      cloneDefaultAmbientPreferences(),
      "porcelana"
    );

    expect(preferences).toMatchObject({
      scheme: "light",
      theme: "porcelana"
    });
  });

  it("projects a Settings scheme selection into the quick-menu theme", () => {
    const crystal = selectAppearanceTheme(
      cloneDefaultAmbientPreferences(),
      "cristal"
    );
    const preferences = selectAppearanceScheme(crystal, "dark", false);

    expect(preferences).toMatchObject({
      scheme: "dark",
      theme: "cristal-noche"
    });
  });

  it("keeps automatic OS changes in the selected material family", () => {
    const preferences = selectAppearanceScheme(
      selectAppearanceTheme(cloneDefaultAmbientPreferences(), "cristal-noche"),
      "auto",
      false
    );

    expect(resolveAppearanceTheme(preferences.theme, false)).toBe("cristal");
    expect(resolveAppearanceTheme(preferences.theme, true)).toBe(
      "cristal-noche"
    );
    expect(preferences.scheme).toBe("auto");
  });
});
