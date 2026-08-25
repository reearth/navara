import type { BillboardMesh as NavaraBillboardMesh } from "@navaramap/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventContext } from "../context";

import { renderBillboard } from "./billboard";

const init = vi.fn().mockResolvedValue(undefined);
const setActive = vi.fn();

vi.mock("../../mesh", () => ({
  InstancedSpriteMesh: class {
    _init = init;
    setActive = setActive;
  },
}));

describe("renderBillboard", () => {
  const ctx = {} as EventContext;

  const createMesh = (url: string) =>
    ({
      material: { url },
      active: true,
    }) as unknown as NavaraBillboardMesh;

  beforeEach(() => {
    init.mockClear();
    setActive.mockClear();
  });

  it("creates a mesh when the material carries a default image", async () => {
    const obj = await renderBillboard(ctx, createMesh("marker.png"));

    expect(obj).toBeDefined();
    expect(init).toHaveBeenCalledOnce();
  });

  // Regression: the mesh used to be skipped when the material had no `url`,
  // so a layer that styles every feature through a FeatureEvaluator
  // (`{ image }`) never got a mesh — and never a `featureCreated` event to
  // attach the evaluator to. Empty atlas rects keep such instances invisible
  // until an image is packed, so the mesh is safe to create eagerly.
  it("creates a mesh when the material has no default image", async () => {
    const obj = await renderBillboard(ctx, createMesh(""));

    expect(obj).toBeDefined();
    expect(init).toHaveBeenCalledOnce();
  });
});
