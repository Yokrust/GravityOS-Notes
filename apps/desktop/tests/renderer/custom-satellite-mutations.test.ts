import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CustomSatelliteErrorNotice } from "../../src/renderer/components/CustomSatelliteErrorNotice.js";
import { CustomSatelliteMutationCoordinator } from "../../src/renderer/lib/custom-satellite-mutations.js";

describe("custom satellite failure notice", () => {
  it("renders a clear, non-blocking persistence error", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomSatelliteErrorNotice, {
        message: "Disk is unavailable",
        onDismiss: vi.fn()
      })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("No se guardaron los cambios");
    expect(markup).toContain("Disk is unavailable");
    expect(markup).toContain('aria-label="Cerrar aviso"');
  });
});

describe("custom satellite mutation recovery", () => {
  it("reports a failed value update and reconciles the authoritative instance", async () => {
    const authoritative = createInstance({ data: { title: "Persisted" } });
    const onError = vi.fn();
    const onReconcile = vi.fn();
    const coordinator = new CustomSatelliteMutationCoordinator({
      loadState: async () => ({
        customTypes: [],
        instances: [authoritative]
      }),
      onError,
      onReconcile
    });

    await coordinator.run("satellite-1", async () => {
      throw new Error("Disk is unavailable");
    });

    expect(onError).toHaveBeenCalledWith("satellite-1", "Disk is unavailable");
    expect(onReconcile).toHaveBeenCalledWith("satellite-1", authoritative);
  });

  it("waits for a pending move before reconciling a failed mutation", async () => {
    const authoritative = createInstance({ x: 80, y: 120 });
    const onReconcile = vi.fn();
    let finishMove: (() => void) | null = null;
    const coordinator = new CustomSatelliteMutationCoordinator({
      loadState: async () => ({
        customTypes: [],
        instances: [authoritative]
      }),
      onError: vi.fn(),
      onReconcile
    });

    const failedValue = coordinator.run("satellite-1", async () => {
      throw new Error("Value failed");
    });
    const pendingMove = coordinator.run(
      "satellite-1",
      () =>
        new Promise<void>((resolve) => {
          finishMove = resolve;
        })
    );
    await failedValue;

    expect(onReconcile).not.toHaveBeenCalled();
    finishMove?.();
    await pendingMove;
    expect(onReconcile).toHaveBeenCalledWith("satellite-1", authoritative);
  });

  it("discards a resize recovery snapshot when a newer mutation starts", async () => {
    const stale = createInstance({ width: 320, height: 420 });
    const fresh = createInstance({ width: 500, height: 600 });
    const onReconcile = vi.fn();
    let resolveFirstLoad: ((state: CustomSatelliteStateRecord) => void) | null =
      null;
    let loadCount = 0;
    const coordinator = new CustomSatelliteMutationCoordinator({
      loadState: () => {
        loadCount += 1;
        if (loadCount === 1) {
          return new Promise((resolve) => {
            resolveFirstLoad = resolve;
          });
        }
        return Promise.resolve({ customTypes: [], instances: [fresh] });
      },
      onError: vi.fn(),
      onReconcile
    });

    const failedResize = coordinator.run("satellite-1", async () => {
      throw new Error("Resize failed");
    });
    await Promise.resolve();
    const newerFailure = coordinator.run("satellite-1", async () => {
      throw new Error("Newer mutation failed");
    });
    resolveFirstLoad?.({ customTypes: [], instances: [stale] });
    await Promise.all([failedResize, newerFailure]);

    expect(onReconcile).toHaveBeenCalledTimes(1);
    expect(onReconcile).toHaveBeenCalledWith("satellite-1", fresh);
  });

  it("restores an optimistically closed Satellite when deletion fails", async () => {
    const authoritative = createInstance();
    const onReconcile = vi.fn();
    const coordinator = new CustomSatelliteMutationCoordinator({
      loadState: async () => ({
        customTypes: [],
        instances: [authoritative]
      }),
      onError: vi.fn(),
      onReconcile
    });

    await coordinator.run("satellite-1", async () => {
      throw new Error("Delete failed");
    });

    expect(onReconcile).toHaveBeenCalledWith("satellite-1", authoritative);
  });
});

function createInstance(
  input: Partial<CustomSatelliteInstanceRecord> = {}
): CustomSatelliteInstanceRecord {
  return {
    createdAt: "2026-06-12T12:00:00.000Z",
    customTypeId: "type-1",
    data: {},
    height: 420,
    id: "satellite-1",
    isOpen: true,
    updatedAt: "2026-06-12T12:00:00.000Z",
    width: 320,
    x: 24,
    y: 24,
    z: 1,
    ...input
  };
}
