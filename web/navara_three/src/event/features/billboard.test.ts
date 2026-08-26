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

  // `url` is omitted from the material entirely when not passed, mirroring the
  // engine's `string | undefined` accessor. The engine itself currently always
  // sends a string (`BillboardMaterial::url` is a `String` defaulting to `""`,
  // converted as `Some(url)`), so `""` is the shape a real url-less layer
  // produces — both are covered below.
  const createMesh = (url?: string) =>
    ({
      material: url === undefined ? {} : { url },
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
  it("creates a mesh when the material's default image is empty", async () => {
    const obj = await renderBillboard(ctx, createMesh(""));

    expect(obj).toBeDefined();
    expect(init).toHaveBeenCalledOnce();
  });

  it("creates a mesh when the material has no `url` at all", async () => {
    const obj = await renderBillboard(ctx, createMesh());

    expect(obj).toBeDefined();
    expect(init).toHaveBeenCalledOnce();
  });
});
