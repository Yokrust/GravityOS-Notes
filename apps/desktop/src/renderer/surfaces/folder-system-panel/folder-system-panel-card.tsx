import { useEffect, useState } from "react";

import { useProjectState } from "../../composition/use-folder-system-state.js";

const pathStatusLabels: Record<ProjectSummary["pathStatus"], string> = {
  ready: "Path ready",
  missing: "Path missing",
  unreadable: "Path unreadable"
};

export function ProjectPanelCard() {
  const { error, setError, setState, state } = useProjectState();
  const [pathInput, setPathInput] = useState("C:/gravity-demo");
  const [renameInput, setRenameInput] = useState("");

  const selectedProject = state?.projects.find(
    (entry) => entry.id === state.selectedProjectId
  );

  useEffect(() => {
    setRenameInput(selectedProject?.displayName ?? "");
  }, [selectedProject?.displayName]);

  async function runAction(action: Promise<ProjectState>) {
    try {
      const nextState = await action;
      setState(nextState);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Project action failed."
      );
    }
  }

  return (
    <section className="card panel-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Panel</p>
          <h2>Register and switch live folders</h2>
        </div>
        <button
          className="secondary-button"
          onClick={() => void runAction(window.gravity.createDemoProject())}
          type="button"
        >
          Create demo
        </button>
      </div>

      <form
        className="panel-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runAction(window.gravity.registerProject(pathInput));
        }}
      >
        <label className="field">
          <span>Root path</span>
          <input
            onChange={(event) => setPathInput(event.target.value)}
            placeholder="C:/my-project"
            value={pathInput}
          />
        </label>
        <div className="button-row">
          <button type="submit">Open existing</button>
          <button
            className="secondary-button"
            onClick={() =>
              void runAction(window.gravity.createProject(pathInput))
            }
            type="button"
          >
            Create folder
          </button>
        </div>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="folder-system-list">
        {state?.projects.length ? (
          state.projects.map((entry) => {
            const isSelected = entry.id === state.selectedProjectId;

            return (
              <article
                className={`folder-system-item${isSelected ? " is-selected" : ""}`}
                key={entry.id}
              >
                <button
                  className="folder-system-select"
                  onClick={() =>
                    void runAction(window.gravity.selectProject(entry.id))
                  }
                  type="button"
                >
                  <strong>{entry.displayName}</strong>
                  <span>{entry.rootPath}</span>
                </button>
                <div className="badge-row">
                  <span className={`status-badge is-${entry.pathStatus}`}>
                    {pathStatusLabels[entry.pathStatus]}
                  </span>
                  <span className="status-badge">
                    {entry.hasRootMap ? "Root map present" : "Root map missing"}
                  </span>
                </div>
                <button
                  className="ghost-button"
                  onClick={() =>
                    void runAction(window.gravity.removeProject(entry.id))
                  }
                  type="button"
                >
                  Forget
                </button>
              </article>
            );
          })
        ) : (
          <p className="empty-state">
            No Projects registered yet. Open an existing folder, create a new
            one, or create the demo.
          </p>
        )}
      </div>

      <form
        className="panel-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedProject) {
            return;
          }

          void runAction(
            window.gravity.renameProject(
              selectedProject.id,
              renameInput || selectedProject.displayName
            )
          );
        }}
      >
        <label className="field">
          <span>Display name</span>
          <input
            disabled={!selectedProject}
            onChange={(event) => setRenameInput(event.target.value)}
            placeholder="Rename selected Project"
            value={selectedProject ? renameInput : ""}
          />
        </label>
        <button disabled={!selectedProject} type="submit">
          Rename selected
        </button>
      </form>
    </section>
  );
}
