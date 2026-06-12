import { useAppearance } from "../lib/appearance.js";

export interface AppearancePreferencesController {
  error: string | null;
  isHydrated: boolean;
  preferences: AppearancePreferencesRecord;
  preview: (preferences: AppearancePreferencesRecord) => void;
  reset: () => Promise<void>;
  save: (preferences: AppearancePreferencesRecord) => Promise<void>;
  selectScheme: (scheme: AppearanceSchemeRecord) => void;
}

export function useAppearancePreferences(): AppearancePreferencesController {
  const { error, isHydrated, preferences, preview, reset, save, selectScheme } =
    useAppearance();
  return {
    error,
    isHydrated,
    preferences,
    preview,
    reset,
    save,
    selectScheme
  };
}
