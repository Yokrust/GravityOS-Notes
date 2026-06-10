import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ThreadsPage } from "../../src/renderer/surfaces/threads-panel/threads-page.js";

describe("threads panel", () => {
  it("keeps the surface navigation and leaves the panel empty", () => {
    const markup = renderToStaticMarkup(
      createElement(ThreadsPage, {
        activeSurface: "threads",
        onSelectSurface: vi.fn()
      })
    );

    expect(markup).toContain("Threads");
    expect(markup).toContain("Notes");
    expect(markup).not.toContain("Chats");
    expect(markup).not.toContain("Projects");
    expect(markup).not.toContain("New conversation");
  });
});
