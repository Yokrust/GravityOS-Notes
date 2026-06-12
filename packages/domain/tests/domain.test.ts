import { describe, expect, it } from "vitest";

import {
  createCustomSatelliteInstance,
  createCustomSatelliteType,
  createProject,
  createConversationThread,
  createInitialRunResult,
  createMapDocument,
  createMapState,
  createRunThread,
  createThreadMessage,
  deriveThreadTitleFromPrompt,
  startRun,
  updateCustomSatelliteInstanceValue,
  updateRunResult
} from "../src/index.js";

describe("custom satellite field semantics", () => {
  it("uses null as the canonical unset value for optional fields", () => {
    const { customType, instance } = createCustomSatelliteFieldContext(false);

    const updated = updateCustomSatelliteInstanceValue({
      customType,
      instance,
      key: "value",
      now: "2026-06-12T12:01:00.000Z",
      value: null
    });

    expect(updated.data).toEqual({ value: null });
  });

  it("rejects null for required fields", () => {
    const { customType, instance } = createCustomSatelliteFieldContext(true);

    expect(() =>
      updateCustomSatelliteInstanceValue({
        customType,
        instance,
        key: "value",
        now: "2026-06-12T12:01:00.000Z",
        value: null
      })
    ).toThrow("Required Satellite property is unset: value");
  });

  it.each([
    ["shortText", ""],
    ["longText", "   "],
    ["number", null],
    ["date", ""],
    ["singleSelect", ""],
    ["multiSelect", []],
    ["checkbox", null],
    ["progress", null],
    ["image", { imageId: " " }]
  ] as const)(
    "normalizes an empty optional %s field to null",
    (valueType, value) => {
      const { customType, instance } = createCustomSatelliteFieldContext(
        false,
        valueType
      );

      expect(
        updateCustomSatelliteInstanceValue({
          customType,
          instance,
          key: "value",
          now: "2026-06-12T12:01:00.000Z",
          value
        }).data
      ).toEqual({ value: null });
    }
  );

  it.each([
    "shortText",
    "longText",
    "number",
    "date",
    "singleSelect",
    "multiSelect",
    "checkbox",
    "progress",
    "image"
  ] as const)("rejects an unset required %s field", (valueType) => {
    const { customType, instance } = createCustomSatelliteFieldContext(
      true,
      valueType
    );

    expect(() =>
      updateCustomSatelliteInstanceValue({
        customType,
        instance,
        key: "value",
        now: "2026-06-12T12:01:00.000Z",
        value: null
      })
    ).toThrow("Required Satellite property is unset: value");
  });

  it.each([
    ["number", 0],
    ["progress", 0],
    ["checkbox", false]
  ] as const)("keeps %s zero-like values as valid data", (valueType, value) => {
    const { customType, instance } = createCustomSatelliteFieldContext(
      true,
      valueType
    );

    expect(
      updateCustomSatelliteInstanceValue({
        customType,
        instance,
        key: "value",
        now: "2026-06-12T12:01:00.000Z",
        value
      }).data
    ).toEqual({ value });
  });
});

describe("domain bootstrap", () => {
  it("creates a folder system without requiring role assignments", () => {
    const project = createProject({
      id: "fs-1",
      displayName: "gravity",
      rootPath: "C:/gravity"
    });

    expect(project.roleAssignments).toEqual([]);
    expect(project.displayName).toBe("gravity");
  });

  it("updates run results independently from run lifecycle state", () => {
    const run = startRun({
      id: "run-1",
      projectId: "fs-1",
      threadId: "thread-1",
      runNumber: 1,
      prompt: "Inspect the map",
      startedAt: "2026-04-22T20:00:00.000Z"
    });
    const runResult = createInitialRunResult(run.id);

    expect(runResult.runId).toBe(run.id);
    expect(
      updateRunResult({
        runResult,
        status: "stopped",
        content: "Partial output",
        artifactPaths: [],
        failureMessage: null
      }).status
    ).toBe("stopped");
  });

  it("derives root map presence from explicit map state", () => {
    expect(
      createMapState({
        hasRootMap: true,
        rootMapPath: "C:/gravity/AGENTS.md"
      })
    ).toEqual({
      status: "present",
      rootMapPath: "C:/gravity/AGENTS.md"
    });
  });

  it("distinguishes root and local map documents", () => {
    expect(
      createMapDocument({
        path: "C:/gravity/AGENTS.md",
        isRoot: true
      })
    ).toEqual({
      path: "C:/gravity/AGENTS.md",
      isRoot: true
    });

    expect(
      createMapDocument({
        path: "C:/gravity/docs/AGENTS.md",
        isRoot: false
      })
    ).toEqual({
      path: "C:/gravity/docs/AGENTS.md",
      isRoot: false
    });
  });

  it("creates a run thread and labels runs within that thread", () => {
    const runThread = createRunThread({
      id: "thread-1",
      projectId: "fs-1",
      title: "Map setup",
      createdAt: "2026-04-22T20:00:00.000Z"
    });
    const run = startRun({
      id: "run-1",
      projectId: runThread.projectId,
      threadId: runThread.id,
      runNumber: 1,
      prompt: "Create a map",
      startedAt: "2026-04-22T20:00:01.000Z"
    });

    expect(runThread.title).toBe("Map setup");
    expect(run.threadId).toBe(runThread.id);
    expect(run.runNumber).toBe(1);
  });

  it("creates conversation threads and derives a first-prompt title", () => {
    const thread = createConversationThread({
      id: "thread-1",
      createdAt: "2026-05-02T20:00:00.000Z"
    });
    const message = createThreadMessage({
      id: "message-1",
      threadId: thread.id,
      role: "user",
      content: "Explain the product direction",
      createdAt: "2026-05-02T20:00:01.000Z"
    });

    expect(thread).toMatchObject({
      projectId: null,
      kind: "conversation",
      title: "New thread"
    });
    expect(message.threadId).toBe(thread.id);
    expect(
      deriveThreadTitleFromPrompt(
        "  Explain   the product direction for the new thread panel in detail  "
      )
    ).toBe("Explain the product direction for the n...");
  });
});

function createCustomSatelliteFieldContext(
  required: boolean,
  valueType:
    | "shortText"
    | "longText"
    | "number"
    | "date"
    | "singleSelect"
    | "multiSelect"
    | "checkbox"
    | "progress"
    | "image" = "number"
) {
  let sequence = 0;
  const ids = {
    next(prefix: string) {
      sequence += 1;
      return `${prefix}-${sequence}`;
    }
  };
  const customType = createCustomSatelliteType({
    id: "type-1",
    ids,
    now: "2026-06-12T12:00:00.000Z",
    proposal: {
      appearance: "card",
      color: "sky",
      icon: "list-checks",
      name: "Field semantics",
      properties: [
        {
          key: "value",
          label: "Value",
          ...(valueType === "singleSelect" || valueType === "multiSelect"
            ? { options: ["One", "Two"] }
            : {}),
          required,
          valueType
        }
      ]
    }
  });
  const instance = createCustomSatelliteInstance({
    customType,
    id: "instance-1",
    now: "2026-06-12T12:00:00.000Z"
  });

  return { customType, instance };
}
