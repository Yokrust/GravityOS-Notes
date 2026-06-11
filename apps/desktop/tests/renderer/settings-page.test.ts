import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SurfaceSwitcher } from "../../src/renderer/components/SurfaceSwitcher.js";
import { SettingsPage } from "../../src/renderer/surfaces/settings-panel/settings-page.js";

describe("settings page", () => {
  it("exposes settings from the shared surface switcher", () => {
    const markup = renderToStaticMarkup(
      createElement(SurfaceSwitcher, {
        activeSurface: "settings",
        onSelectSurface: vi.fn()
      })
    );

    expect(markup).toContain("Threads");
    expect(markup).toContain("Notes");
    expect(markup).toContain("Settings");
    expect(markup).toContain('aria-current="page"');
  });

  it("renders the requested configuration sections", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsPage, {
        activeSurface: "settings",
        onSelectSurface: vi.fn()
      })
    );

    expect(markup).toContain("Api provider");
    expect(markup).toContain("Features");
    expect(markup).toContain("Notifications");
    expect(markup).toContain("Mail");
    expect(markup).toContain("Teams");
    expect(markup).toContain("Cargando proveedores");
  });
});
