import { describe, expect, it } from "vitest";

import {
  INITIAL_SURFACE_NAVIGATION,
  selectSurface,
  toggleSettings
} from "../../src/renderer/lib/surface-navigation.js";

describe("surface navigation", () => {
  it("opens on Notes by default", () => {
    expect(INITIAL_SURFACE_NAVIGATION.activeSurface).toBe("notes");
  });

  it("returns to Notes after opening Settings from Notes", () => {
    let state = INITIAL_SURFACE_NAVIGATION;

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("settings");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("notes");
  });

  it("returns to Threads after opening Settings from Threads", () => {
    let state = selectSurface(INITIAL_SURFACE_NAVIGATION, "threads");
    expect(state.activeSurface).toBe("threads");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("settings");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("threads");
  });

  it("remembers the latest content surface when switching before Settings", () => {
    let state = selectSurface(INITIAL_SURFACE_NAVIGATION, "threads");
    state = selectSurface(state, "notes");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("settings");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("notes");
  });

  it("keeps SurfaceSwitcher navigation explicit while in Settings", () => {
    let state = selectSurface(INITIAL_SURFACE_NAVIGATION, "threads");
    state = toggleSettings(state);
    expect(state.activeSurface).toBe("settings");

    // Selecting a content surface from within Settings navigates there
    // directly and updates the surface Settings would return to.
    state = selectSurface(state, "notes");
    expect(state.activeSurface).toBe("notes");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("settings");
    state = toggleSettings(state);
    expect(state.activeSurface).toBe("notes");
  });

  it("treats selecting Settings explicitly like toggling it open", () => {
    let state = selectSurface(INITIAL_SURFACE_NAVIGATION, "threads");

    state = selectSurface(state, "settings");
    expect(state.activeSurface).toBe("settings");

    state = toggleSettings(state);
    expect(state.activeSurface).toBe("threads");
  });
});
