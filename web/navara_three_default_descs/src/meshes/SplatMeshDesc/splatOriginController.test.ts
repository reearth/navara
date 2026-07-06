import type { SplatMesh } from "@sparkjsdev/spark";
import {
  Euler,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { describe, it, expect } from "vitest";

import { SplatOriginController } from "./splatOriginController";

const CELL = 2000;

/** A camera whose world position is `(x, y, z)`. */
const cameraAt = (x: number, y: number, z: number): PerspectiveCamera => {
  const cam = new PerspectiveCamera();
  cam.position.set(x, y, z);
  cam.updateMatrixWorld(true);
  return cam;
};

/** An ECEF-scale world matrix with distinct translation, rotation and scale. */
const ecefMatrix = (translation: Vector3): Matrix4 =>
  new Matrix4().compose(
    translation,
    new Quaternion().setFromEuler(new Euler(0.3, 0.5, -0.2)),
    new Vector3(5, 5, 5),
  );

/** A stand-in SplatMesh (only `matrixWorld` / auto-update flags are touched). */
const meshWith = (ecef: Matrix4): Object3D => {
  const mesh = new Object3D();
  mesh.matrixWorld.copy(ecef); // base class placed it at ECEF before registration
  return mesh;
};

const asSplat = (mesh: Object3D): SplatMesh => mesh as unknown as SplatMesh;

const translationOf = (m: Matrix4): Vector3 =>
  new Vector3().setFromMatrixPosition(m);

describe("SplatOriginController", () => {
  describe("grid snapping", () => {
    it("snaps the origin to the nearest cell center of the camera", () => {
      const c = new SplatOriginController(CELL);
      c.update(cameraAt(1500, -300, 6_000_050));
      // round(1500/2000)=1 → 2000; round(-300/2000)=0 → 0; round(3000.025)=3000 → 6_000_000
      expect(c.origin.x).toBeCloseTo(2000, 6);
      expect(c.origin.y).toBeCloseTo(0, 6);
      expect(c.origin.z).toBeCloseTo(6_000_000, 6);
    });

    it("keeps the same origin reference across updates (patch reads it live)", () => {
      const c = new SplatOriginController(CELL);
      const ref = c.origin;
      c.update(cameraAt(0, 0, 0));
      c.update(cameraAt(9_000, 9_000, 9_000));
      expect(c.origin).toBe(ref);
    });
  });

  describe("recenter math", () => {
    it("folds the origin out of the mesh translation (net placement preserved)", () => {
      const c = new SplatOriginController(CELL);
      const worldPos = new Vector3(6_378_137, 100_500, 3_000_250);
      const ecef = ecefMatrix(worldPos);
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());

      c.update(cameraAt(6_378_100, 100_400, 3_000_200));

      const recentered = translationOf(mesh.matrixWorld);
      // recentered = worldPos - origin  ⇒  origin + recentered = worldPos
      expect(recentered.clone().add(c.origin).x).toBeCloseTo(worldPos.x, 3);
      expect(recentered.clone().add(c.origin).y).toBeCloseTo(worldPos.y, 3);
      expect(recentered.clone().add(c.origin).z).toBeCloseTo(worldPos.z, 3);
    });

    it("shrinks the coordinates the renderer sees to within ~one cell", () => {
      const c = new SplatOriginController(CELL);
      const worldPos = new Vector3(6_378_137, 100_500, 3_000_250);
      const ecef = ecefMatrix(worldPos);
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());

      c.update(cameraAt(worldPos.x, worldPos.y, worldPos.z));

      // Camera sits on the object, so the recentered center is within the cell.
      expect(translationOf(mesh.matrixWorld).length()).toBeLessThan(CELL * 2);
    });

    it("preserves rotation and scale, shifting only translation", () => {
      const c = new SplatOriginController(CELL);
      const ecef = ecefMatrix(new Vector3(5_000_000, 0, 4_000_000));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());
      c.update(cameraAt(5_000_000, 0, 4_000_000));

      const pos = new Vector3();
      const quat = new Quaternion();
      const scale = new Vector3();
      mesh.matrixWorld.decompose(pos, quat, scale);

      const expectedQuat = new Quaternion().setFromEuler(
        new Euler(0.3, 0.5, -0.2),
      );
      expect(scale.x).toBeCloseTo(5, 6);
      expect(scale.y).toBeCloseTo(5, 6);
      expect(scale.z).toBeCloseTo(5, 6);
      expect(Math.abs(quat.dot(expectedQuat))).toBeCloseTo(1, 6);
    });

    it("marks the mesh matrices non-auto-updating so the recenter persists", () => {
      const c = new SplatOriginController(CELL);
      const ecef = ecefMatrix(new Vector3(6_000_000, 0, 0));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());
      c.update(cameraAt(6_000_000, 0, 0));

      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.matrixWorldAutoUpdate).toBe(false);
    });
  });

  describe("registration lifecycle", () => {
    it("recenters a mesh immediately when registered after the origin exists", () => {
      const c = new SplatOriginController(CELL);
      c.update(cameraAt(6_000_000, 0, 0)); // establish origin first

      const ecef = ecefMatrix(new Vector3(6_000_100, 0, 0));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone()); // should recenter right away

      expect(translationOf(mesh.matrixWorld).length()).toBeLessThan(CELL * 2);
    });

    it("does not touch a mesh registered before any origin is established", () => {
      const c = new SplatOriginController(CELL);
      const ecef = ecefMatrix(new Vector3(6_000_000, 0, 0));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());

      // Still at its original ECEF matrix until the first update().
      expect(mesh.matrixWorld.equals(ecef)).toBe(true);
    });

    it("re-registering replaces the stored matrix so transform updates take effect", () => {
      const c = new SplatOriginController(CELL);
      const mesh = meshWith(ecefMatrix(new Vector3(6_000_000, 0, 0)));
      c.register(asSplat(mesh), new Matrix4().copy(mesh.matrixWorld));
      c.update(cameraAt(6_000_000, 0, 0));

      // Simulate a transform update: the mesh now sits at a new ECEF position.
      const moved = ecefMatrix(new Vector3(6_000_000, 500, 0));
      c.register(asSplat(mesh), moved.clone());

      // Cross a cell so the controller re-derives from its stored matrix.
      c.update(cameraAt(6_000_000, 500, 0));

      // Net world placement must reflect the NEW matrix (y = 500), not the old.
      const world = translationOf(mesh.matrixWorld).add(c.origin);
      expect(world.y).toBeCloseTo(500, 3);
    });

    it("stops recentering a mesh after it is unregistered", () => {
      const c = new SplatOriginController(CELL);
      const ecef = ecefMatrix(new Vector3(6_000_000, 0, 0));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());
      c.update(cameraAt(6_000_000, 0, 0));

      c.unregister(asSplat(mesh));
      const marker = new Matrix4().makeTranslation(1, 2, 3);
      mesh.matrixWorld.copy(marker);

      c.update(cameraAt(6_050_000, 0, 0)); // crosses many cells
      expect(mesh.matrixWorld.equals(marker)).toBe(true);
    });
  });

  describe("cell-change behavior", () => {
    it("does not recenter while the camera stays inside the same cell", () => {
      const c = new SplatOriginController(CELL);
      const ecef = ecefMatrix(new Vector3(6_000_000, 0, 0));
      const mesh = meshWith(ecef);
      c.register(asSplat(mesh), ecef.clone());
      c.update(cameraAt(6_000_000, 0, 0));

      // Overwrite with a marker; a same-cell update must leave it untouched.
      const marker = new Matrix4().makeTranslation(7, 8, 9);
      mesh.matrixWorld.copy(marker);
      c.update(cameraAt(6_000_500, 100, -100)); // still snaps to 6_000_000

      expect(mesh.matrixWorld.equals(marker)).toBe(true);
    });

    it("recenters every registered mesh when the camera crosses a cell", () => {
      const c = new SplatOriginController(CELL);
      const a = meshWith(ecefMatrix(new Vector3(6_000_000, 0, 0)));
      const b = meshWith(ecefMatrix(new Vector3(6_000_040, 0, 0)));
      c.register(asSplat(a), new Matrix4().copy(a.matrixWorld));
      c.register(asSplat(b), new Matrix4().copy(b.matrixWorld));
      c.update(cameraAt(0, 0, 0));

      const before = c.origin.clone();
      c.update(cameraAt(6_000_000, 0, 0)); // far cell → origin moves
      expect(c.origin.equals(before)).toBe(false);

      // Both meshes are now local to the new origin.
      expect(translationOf(a.matrixWorld).length()).toBeLessThan(CELL * 2);
      expect(translationOf(b.matrixWorld).length()).toBeLessThan(CELL * 2);
    });
  });
});
