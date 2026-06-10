export function describeProjectContextStatus(
  pathStatus: ProjectSummary["pathStatus"]
) {
  return pathStatus === "missing"
    ? {
        title: "Project context unavailable",
        detail:
          "The attached folder is missing. History stays visible, but new execution is blocked until you reattach project context."
      }
    : {
        title: "Project context unreadable",
        detail:
          "The attached folder cannot be read right now. History stays visible, but new execution is blocked until you reattach project context."
      };
}

export function ProjectContextStatus({
  onPathInputChange,
  pathInput,
  pathStatus,
  projectName,
  rootPath
}: {
  onPathInputChange: (value: string) => void;
  pathInput: string;
  pathStatus: ProjectSummary["pathStatus"];
  projectName: string;
  rootPath: string;
}) {
  const status = describeProjectContextStatus(pathStatus);

  return (
    <div className="panel-section">
      <div className="panel-warning" role="status">
        <strong>{status.title}</strong>
        <p>{status.detail}</p>
        <p>
          <span>{projectName}</span>
          {" | "}
          <span>{rootPath}</span>
        </p>
      </div>
      <p className="panel-warning">
        Reattaching a different folder may change the project working context.
      </p>
      <label className="compact-field">
        <span>Reattach path</span>
        <input
          name="reattach-path"
          onChange={(event) => onPathInputChange(event.target.value)}
          placeholder={rootPath}
          value={pathInput}
        />
      </label>
      <div className="compact-actions">
        <button type="submit">Reattach context</button>
      </div>
    </div>
  );
}
