import { useCallback, useState } from "react";

import type { AppSurface } from "./app-surface.js";

/**
 * Surfaces that hold primary content. Settings is a temporary surface layered
 * on top of one of these and always returns to the one it was opened from.
 */
export type ContentSurface = Exclude<AppSurface, "settings">;

export interface SurfaceNavigationState {
  /** Surface currently shown to the user. */
  activeSurface: AppSurface;
  /** Content surface to restore when Settings is dismissed. */
  lastContentSurface: ContentSurface;
}

export const INITIAL_SURFACE_NAVIGATION: SurfaceNavigationState = {
  activeSurface: "notes",
  lastContentSurface: "notes"
};

/**
 * Resolve an explicit surface selection. Selecting a content surface records it
 * as the surface to return to; selecting Settings keeps the prior content
 * surface so closing Settings comes back to it.
 */
export function selectSurface(
  state: SurfaceNavigationState,
  surface: AppSurface
): SurfaceNavigationState {
  if (surface === "settings") {
    return { ...state, activeSurface: "settings" };
  }
  return { activeSurface: surface, lastContentSurface: surface };
}

/**
 * Toggle the Settings surface. Opening Settings remembers the active content
 * surface; closing it restores that surface instead of always falling back to
 * Notes.
 */
export function toggleSettings(
  state: SurfaceNavigationState
): SurfaceNavigationState {
  if (state.activeSurface === "settings") {
    return { ...state, activeSurface: state.lastContentSurface };
  }
  return { ...state, activeSurface: "settings" };
}

export interface SurfaceNavigationController {
  activeSurface: AppSurface;
  selectSurface: (surface: AppSurface) => void;
  toggleSettings: () => void;
}

/**
 * Stateful binding of the surface-navigation reducer for use in the app shell.
 */
export function useSurfaceNavigation(): SurfaceNavigationController {
  const [state, setState] = useState<SurfaceNavigationState>(
    INITIAL_SURFACE_NAVIGATION
  );

  const select = useCallback((surface: AppSurface) => {
    setState((current) => selectSurface(current, surface));
  }, []);

  const toggle = useCallback(() => {
    setState((current) => toggleSettings(current));
  }, []);

  return {
    activeSurface: state.activeSurface,
    selectSurface: select,
    toggleSettings: toggle
  };
}
