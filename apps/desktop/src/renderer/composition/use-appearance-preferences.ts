import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyAmbientTheme,
  buildAmbientTheme,
  cloneDefaultAmbientPreferences
} from "../lib/ambient.js";

export interface AppearancePreferencesController {
  error: string | null;
  isHydrated: boolean;
  preferences: AppearancePreferencesRecord;
  preview: (preferences: AppearancePreferencesRecord) => void;
  reset: () => Promise<void>;
  save: (preferences: AppearancePreferencesRecord) => Promise<void>;
}

/**
 * Preferencias del ambiente generativo: se hidratan desde el proceso main,
 * se previsualizan en vivo y se guardan en serie (la última escritura gana).
 */
export function useAppearancePreferences(): AppearancePreferencesController {
  const [preferences, setPreferences] = useState<AppearancePreferencesRecord>(
    cloneDefaultAmbientPreferences
  );
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const saveTicket = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const load = window.gravity?.getAppearancePreferences;
    if (!load) {
      setIsHydrated(true);
      return;
    }

    let cancelled = false;
    load()
      .then((stored) => {
        if (!cancelled) {
          setPreferences(stored);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(describeError(cause));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyAmbientTheme(
        document.documentElement,
        buildAmbientTheme(preferences, media.matches),
        preferences.texture
      );
    };

    apply();
    if (preferences.scheme === "auto") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [preferences]);

  const preview = useCallback((next: AppearancePreferencesRecord) => {
    setPreferences(next);
  }, []);

  const save = useCallback(async (next: AppearancePreferencesRecord) => {
    setPreferences(next);
    const persist = window.gravity?.saveAppearancePreferences;
    if (!persist) return;

    const ticket = saveTicket.current + 1;
    saveTicket.current = ticket;
    let saved: AppearancePreferencesRecord | null = null;
    let failure: unknown = null;

    saveQueue.current = saveQueue.current
      .then(async () => {
        saved = await persist(next);
      })
      .catch((cause: unknown) => {
        failure = cause;
      });
    await saveQueue.current;

    if (ticket !== saveTicket.current) return;
    if (failure) {
      setError(describeError(failure));
      return;
    }
    if (saved) {
      setPreferences(saved);
      setError(null);
    }
  }, []);

  const reset = useCallback(async () => {
    await save(cloneDefaultAmbientPreferences());
  }, [save]);

  return { error, isHydrated, preferences, preview, reset, save };
}

function describeError(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "No se pudieron guardar las preferencias de apariencia.";
}
