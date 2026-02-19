import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshLambertMaterial,
} from "three";
import { describe, expect, it, vi } from "vitest";

import type { ViewContext } from "../core";
import type { CommonUniforms } from "../uniforms";

import { PolygonMesh } from "./polygon";

// Mock @navara/worker to avoid os.cpus() in test environment
vi.mock("@navara/worker", () => ({}));

// Minimal mocks — only clone() and dispose() are tested, not the full lifecycle
const mockViewContext = {} as ViewContext;
const mockUniforms = {} as CommonUniforms;

function createTestMesh(): PolygonMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1]), 3),
  );
  geometry.setIndex([0, 1, 0]);

  const material = new MeshLambertMaterial({ color: 0xff0000 });

  // PolygonMesh expects BufferGeometry<Attributes> with specific attributes,
  // but for clone/dispose testing we only need basic geometry.

  return new PolygonMesh(
    mockViewContext,
    "test-layer",
    mockUniforms,
    geometry as any,
    material,
  );
}

/**
 * Simulate what disposeObject3D does to a mesh's geometry and material.
 * This mirrors the behavior in event/index.ts without importing it
 * (which would pull in heavy engine dependencies).
 */
function simulateDispose(mesh: Mesh): void {
  const g = mesh.geometry;
  g.dispose();
  for (const key of Object.keys(g.attributes)) {
    g.deleteAttribute(key);
  }
  g.index = null;
  g.boundingBox = null;
  g.boundingSphere = null;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose());
  } else {
    mesh.material.dispose();
  }
}

describe("PolygonMesh clone", () => {
  it("should create clone with independent geometry and material", () => {
    const original = createTestMesh();
    const clone = original.clone();

    // Objects are different instances
    expect(clone.geometry).not.toBe(original.geometry);
    expect(clone.material).not.toBe(original.material);

    // Geometry data is equivalent
    const origPos = original.geometry.getAttribute("position");
    const clonePos = clone.geometry.getAttribute("position");
    if (!origPos || !clonePos) {
      throw new Error("position attribute should exist");
    }
    expect(clonePos).not.toBe(origPos);
    expect(clonePos.count).toBe(origPos.count);
  });

  it("should not break clone geometry when original is disposed", () => {
    const original = createTestMesh();
    const clone = original.clone();

    // Dispose original (simulates disposeObject3D in event/index.ts)
    simulateDispose(original);

    // Original geometry is destroyed
    expect(original.geometry.getAttribute("position")).toBeUndefined();
    expect(original.geometry.index).toBeNull();

    // Clone geometry is intact
    const clonePos = clone.geometry.getAttribute("position");
    if (!clonePos) {
      throw new Error("clone position attribute should survive disposal");
    }
    expect(clonePos.count).toBe(2);
    expect(clone.geometry.index).not.toBeNull();
  });
});
