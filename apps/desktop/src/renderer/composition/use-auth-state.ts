import { useCallback, useEffect, useState } from "react";

import { t } from "../lib/i18n.js";

export function useAuthState() {
  const [state, setState] = useState<AuthStateRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.gravity) {
      setError(
        t("Los proveedores solo están disponibles en la app de escritorio.")
      );
      return null;
    }
    try {
      const nextState = await window.gravity.getAuthState();
      setState(nextState);
      setError(null);
      return nextState;
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Auth refresh failed."
      );
      return null;
    }
  }, []);

  useEffect(() => {
    if (!window.gravity) {
      setError(
        t("Los proveedores solo están disponibles en la app de escritorio.")
      );
      return;
    }

    let cancelled = false;

    void window.gravity
      .getAuthState()
      .then((nextState) => {
        if (!cancelled) {
          setState(nextState);
          setError(null);
        }
      })
      .catch((nextError: Error) => {
        if (!cancelled) {
          setError(nextError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state?.activeFlow) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, 900);

    return () => {
      window.clearInterval(interval);
    };
  }, [refresh, state?.activeFlow]);

  const saveApiKey = useCallback(async (providerId: string, apiKey: string) => {
    try {
      const nextState = await window.gravity.saveProviderApiKey(
        providerId,
        apiKey
      );
      setState(nextState);
      setError(null);
      return nextState;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Saving API key failed."
      );
      return null;
    }
  }, []);

  const beginOAuthLogin = useCallback(async (providerId: string) => {
    try {
      const nextState =
        await window.gravity.beginProviderOAuthLogin(providerId);
      setState(nextState);
      setError(null);
      return nextState;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Provider login failed."
      );
      return null;
    }
  }, []);

  const submitOAuthInput = useCallback(
    async (flowId: string, value: string) => {
      try {
        const nextState = await window.gravity.submitProviderOAuthInput(
          flowId,
          value
        );
        setState(nextState);
        setError(null);
        return nextState;
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Submitting provider input failed."
        );
        return null;
      }
    },
    []
  );

  const logout = useCallback(async (providerId: string) => {
    try {
      const nextState = await window.gravity.logoutProvider(providerId);
      setState(nextState);
      setError(null);
      return nextState;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Clearing provider auth failed."
      );
      return null;
    }
  }, []);

  return {
    beginOAuthLogin,
    error,
    logout,
    refresh,
    saveApiKey,
    setError,
    state,
    submitOAuthInput
  };
}
