import { useCallback, useEffect, useState } from "react";

const PROJECT_STATE_EVENT = "gravity:project-state";

export function useProjectState() {
  const [state, setState] = useState<ProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setSharedState = useCallback((nextState: ProjectState) => {
    setState(nextState);
    window.dispatchEvent(
      new CustomEvent<ProjectState>(PROJECT_STATE_EVENT, {
        detail: nextState
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    function updateFromSharedEvent(event: Event) {
      const nextState = (event as CustomEvent<ProjectState>).detail;
      setState(nextState);
    }

    void window.gravity
      .getProjectState()
      .then((nextState) => {
        if (!cancelled) {
          setSharedState(nextState);
        }
      })
      .catch((nextError: Error) => {
        if (!cancelled) {
          setError(nextError.message);
        }
      });
    window.addEventListener(PROJECT_STATE_EVENT, updateFromSharedEvent);

    return () => {
      cancelled = true;
      window.removeEventListener(PROJECT_STATE_EVENT, updateFromSharedEvent);
    };
  }, [setSharedState]);

  return { error, setError, setState: setSharedState, state };
}
