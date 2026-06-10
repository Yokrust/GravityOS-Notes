import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  describeProjectContextStatus,
  ProjectContextStatus
} from "../../src/renderer/components/ProjectContextStatus.js";

describe("project context status", () => {
  it("describes missing project context as blocked execution with reattach guidance", () => {
    expect(describeProjectContextStatus("missing")).toEqual({
      title: "Project context unavailable",
      detail:
        "The attached folder is missing. History stays visible, but new execution is blocked until you reattach project context."
    });
  });

  it("renders a reattach form for unavailable projects", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectContextStatus, {
        onPathInputChange: vi.fn(),
        pathInput: "C:/reattached-gravity",
        pathStatus: "missing",
        projectName: "Gravity",
        rootPath: "C:/missing-gravity"
      })
    );

    expect(markup).toContain("Project context unavailable");
    expect(markup).toContain("History stays visible");
    expect(markup).toContain(
      "Reattaching a different folder may change the project working context."
    );
    expect(markup).toContain("Reattach path");
    expect(markup).toContain("Reattach context");
    expect(markup).toContain("C:/missing-gravity");
    expect(markup).toContain('value="C:/reattached-gravity"');
  });
});
