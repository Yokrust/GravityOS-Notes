import { describe, expect, it } from "vitest";

import {
  INITIAL_APPEARANCE_PREFERENCES,
  resolveThemePoints,
  resolveThemePresentation
} from "../../src/renderer/lib/theme/appearance.js";

describe("theme appearance", () => {
  it("derives harmony points without changing the persisted primary point", () => {
    const preferences = {
      ...INITIAL_APPEARANCE_PREFERENCES,
      harmony: "triadic" as const,
      points: [{ x: 0.5, y: 0.2 }]
    };

    const points = resolveThemePoints(preferences);

    expect(points).toHaveLength(3);
    expect(points[0]).toEqual(preferences.points[0]);
  });

  it("preserves every user point in free mode", () => {
    const points = [
      { x: 0.2, y: 0.4 },
      { x: -0.5, y: 0.1 },
      { x: 0.1, y: -0.7 }
    ];

    expect(
      resolveThemePoints({
        ...INITIAL_APPEARANCE_PREFERENCES,
        harmony: "floating",
        points
      })
    ).toEqual(points);
  });

  it("resolves system scheme and emits usable global tokens", () => {
    const presentation = resolveThemePresentation(
      {
        ...INITIAL_APPEARANCE_PREFERENCES,
        scheme: "auto"
      },
      false
    );

    expect(presentation.isDark).toBe(false);
    expect(presentation.tokens["--bg"]).toBe("#f4f4f2");
    expect(presentation.tokens["--accent"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(presentation.tokens["--accent-ink"]).toMatch(/^#/);
    expect(presentation.gradientCss).toContain("gradient");
  });
});
