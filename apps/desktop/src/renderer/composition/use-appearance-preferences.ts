import type { AppearancePreferences } from "@gravity/application";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  INITIAL_APPEARANCE_PREFERENCES,
  applyThemePresentation,
  resolveThemePresentation
} from "../lib/theme/appearance.js";

function cloneDefaults(): AppearancePreferences {
  return {
    ...INITIAL_APPEARANCE_PREFERENCES,
    points: INITIAL_APPEARANCE_PREFERENCES.points.map((point) => ({ ...point }))
  };
}

export function useAppearancePreferences() {
  const [preferences, setPreferences] =
    useState<AppearancePreferences>(cloneDefaults);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestSave = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const getPreferences = window.gravity?.getAppearancePreferences;
    if (!getPreferences) {
      setIsHydrated(true);
      return;
    }

    let isCancelled = false;
    void getPreferences()
      .then((nextPreferences) => {
        if (!isCancelled) {
          setPreferences(nextPreferences);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(cause));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyThemePresentation(
        document.documentElement,
        resolveThemePresentation(preferences, media.matches)
      );
    };

    apply();
    if (preferences.scheme !== "auto") {
      return;
    }

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences]);

  const preview = useCallback((nextPreferences: AppearancePreferences) => {
    setPreferences(nextPreferences);
  }, []);

  const save = useCallback(async (nextPreferences: AppearancePreferences) => {
    setPreferences(nextPreferences);
    const savePreferences = window.gravity?.saveAppearancePreferences;
    if (!savePreferences) {
      return;
    }

    const saveId = latestSave.current + 1;
    latestSave.current = saveId;
    let persisted: AppearancePreferences | null = null;
    let failure: unknown = null;

    saveQueue.current = saveQueue.current
      .then(async () => {
        persisted = await savePreferences(nextPreferences);
      })
      .catch((cause: unknown) => {
        failure = cause;
      });
    await saveQueue.current;

    if (saveId !== latestSave.current) {
      return;
    }

    if (failure) {
      setError(getErrorMessage(failure));
      return;
    }

    if (persisted) {
      setPreferences(persisted);
      setError(null);
    }
  }, []);

  const reset = useCallback(async () => {
    const defaults = cloneDefaults();
    await save(defaults);
  }, [save]);

  return {
    error,
    isHydrated,
    preferences,
    preview,
    reset,
    save
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudieron guardar las preferencias de apariencia.";
}
