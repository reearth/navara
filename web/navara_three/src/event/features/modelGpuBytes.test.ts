import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Uint16BufferAttribute,
  DataTexture,
} from "three";
import { describe, expect, it } from "vitest";

import { sumModelGpuBytes } from "./modelGpuBytes";

describe("sumModelGpuBytes", () => {
  it("sums geometry attribute + index bytes across the object tree", () => {
    const geometry = new BufferGeometry();
    // 3 vertices × 3 floats × 4 bytes = 36 bytes.
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    // 3 indices × 2 bytes = 6 bytes.
    geometry.setIndex(new Uint16BufferAttribute([0, 1, 2], 1));

    const group = new Group();
    group.add(new Mesh(geometry, new MeshBasicMaterial()));

    // Geometry is counted once (GPU_GEOMETRY_RESIDENCY_FACTOR = 1): the CPU
    // typed arrays are released via onUpload after the first GPU upload, so
    // only the GPU copy stays resident.
    expect(sumModelGpuBytes(group)).toBe(36 + 6);
  });

  it("counts a shared texture only once, without the residency factor", () => {
    // 2×2 RGBA DataTexture → image.data.byteLength = 16.
    const tex = new DataTexture(new Uint8Array(16), 2, 2);
    const matA = new MeshBasicMaterial({ map: tex });
    const matB = new MeshBasicMaterial({ map: tex });

    const group = new Group();
    group.add(new Mesh(new BufferGeometry(), matA));
    group.add(new Mesh(new BufferGeometry(), matB));

    // The shared texture's 16 bytes are counted once, not twice, and textures
    // are not scaled by the geometry residency factor.
    expect(sumModelGpuBytes(group)).toBe(16);
  });

  it("counts geometry and textures once each when both are present", () => {
    const geometry = new BufferGeometry();
    // 3 vertices × 3 floats × 4 bytes = 36 bytes.
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    // 2×2 RGBA DataTexture → 16 bytes.
    const tex = new DataTexture(new Uint8Array(16), 2, 2);

    const group = new Group();
    group.add(new Mesh(geometry, new MeshBasicMaterial({ map: tex })));

    // 36 geometry bytes × 1 + 16 texture bytes × 1 = 52.
    expect(sumModelGpuBytes(group)).toBe(36 + 16);
  });

  it("returns 0 for an empty object", () => {
    expect(sumModelGpuBytes(new Group())).toBe(0);
  });
});
