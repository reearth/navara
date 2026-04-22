import type { BaseEventMap, XYZ } from "@navara/core";
import {
  BufferGeometry,
  Color as ThreeColor,
  Euler,
  InstancedMesh,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import invariant from "tiny-invariant";

import {
  MeshDescWithSelectiveEffect,
  type MeshConfigWithSelectiveEffect,
  type MeshUpdateWithSelectiveEffect,
} from "./MeshDescWithSelectiveEffect";

export type InstancedMeshConfig = MeshConfigWithSelectiveEffect;
export type InstancedMeshUpdate = MeshUpdateWithSelectiveEffect;

/**
 * Common transform fields for individual instances within an instanced mesh descriptor.
 * Mirrors the transform fields of `MeshConfig` at the parent level.
 *
 * When `matrix` is provided, it is used directly and `position`, `rotation`, `scale`
 * are ignored.
 */
export type InstancedChildConfig = {
  /** Local position relative to the parent group. */
  position?: XYZ;
  /** Local rotation (Euler angles in radians). */
  rotation?: XYZ;
  /** Local scale. */
  scale?: XYZ;
  /** Pre-computed transform matrix. When set, position/rotation/scale are ignored. */
  matrix?: Matrix4;
};

const DEFAULT_CAPACITY = 64;
const GROWTH_FACTOR = 2;

// Reusable temporaries to avoid per-call allocations
const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3();
const _euler = new Euler();
const _matrix = new Matrix4();
const _defaultColor = new ThreeColor(0xffffff);
const _swapMatrix = new Matrix4();
const _swapColor = new ThreeColor();

/**
 * Abstract base class for instanced mesh descriptors using GPU instancing via Three.js `InstancedMesh`.
 *
 * All instances share a single geometry and material, rendered in one draw call.
 * Per-instance variation is achieved through `instanceMatrix` (position, rotation, scale)
 * and `instanceColor` (per-instance color).
 *
 * The parent's transform fields (position, scale, rotation, matrix, matrixWorld)
 * define the parent coordinate space. Each instance's transform is local to the parent.
 *
 * Subclasses that maintain external per-instance state (e.g. picking batchIds)
 * can override the `onInstance*` lifecycle hooks to stay in sync with
 * `add` / `removeAt` / `clear` / `replaceAll` / capacity grows.
 *
 * @typeParam Config - Layer configuration type
 * @typeParam UpdateConfig - Updatable properties type
 * @typeParam ChildConfig - Configuration type for individual instances
 * @typeParam CustomEvent - Additional custom events
 */
export abstract class InstancedMeshDesc<
  TGeometry extends BufferGeometry = BufferGeometry,
  TMaterial extends Material = Material,
  Config extends InstancedMeshConfig = InstancedMeshConfig,
  UpdateConfig extends InstancedMeshUpdate = InstancedMeshUpdate,
  ChildConfig extends InstancedChildConfig = InstancedChildConfig,
  CustomEvent extends BaseEventMap = BaseEventMap,
> extends MeshDescWithSelectiveEffect<
  Config,
  UpdateConfig,
  InstancedMesh<TGeometry, TMaterial>,
  CustomEvent
> {
  protected configs: ChildConfig[] = [];
  private capacity = 0;

  /** Create the shared geometry for all instances. */
  protected abstract createGeometry(): TGeometry;

  /** Create the shared material for all instances. */
  protected abstract createMaterial(): TMaterial;

  /** Extract the initial array of instance configs from the layer config. */
  protected abstract getChildConfigs(): ChildConfig[];

  /** Extract the per-instance color, or undefined if no color. */
  protected abstract getInstanceColor(
    config: ChildConfig,
  ): ThreeColor | undefined;

  /**
   * Compose a Matrix4 encoding position, rotation, and scale for one instance.
   *
   * When `config.matrix` is provided, it is returned directly.
   * Otherwise the matrix is composed from `position`, `rotation`, and scale
   * (computed by {@link getInstanceScale}).
   *
   * Override {@link getInstanceScale} to incorporate geometry-specific dimensions
   * (e.g., width/height/depth for boxes) into the scale.
   */
  protected composeInstanceMatrix(config: ChildConfig): Matrix4 {
    if (config.matrix) return config.matrix;

    const pos = config.position;
    _position.set(pos?.x ?? 0, pos?.y ?? 0, pos?.z ?? 0);

    const rot = config.rotation;
    if (rot) {
      _euler.set(rot.x, rot.y, rot.z);
      _quaternion.setFromEuler(_euler);
    } else {
      _quaternion.identity();
    }

    this.getInstanceScale(config, _scale);

    _matrix.compose(_position, _quaternion, _scale);
    return _matrix;
  }

  /**
   * Compute per-instance scale. Override to incorporate geometry-specific
   * dimensions (e.g., width/height/depth) into the scale.
   *
   * The default implementation uses `config.scale` directly.
   */
  protected getInstanceScale(config: ChildConfig, target: Vector3): void {
    const s = config.scale;
    target.set(s?.x ?? 1, s?.y ?? 1, s?.z ?? 1);
  }

  createMesh(): InstancedMesh<TGeometry, TMaterial> {
    const configs = this.getChildConfigs();
    this.capacity = Math.max(configs.length, DEFAULT_CAPACITY);

    const mesh = new InstancedMesh(
      this.createGeometry(),
      this.createMaterial(),
      this.capacity,
    );
    mesh.count = configs.length;

    for (let i = 0; i < configs.length; i++) {
      mesh.setMatrixAt(i, this.composeInstanceMatrix(configs[i]));
      const color = this.getInstanceColor(configs[i]) ?? _defaultColor;
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.configs = [...configs];

    return mesh;
  }

  /** Add a new instance. Returns the index of the added instance. */
  add(config: ChildConfig): number {
    const count = this.raw?.count ?? 0;
    if (count >= this.capacity) {
      this.grow();
    }

    const mesh = this.raw;
    invariant(mesh, "Layer must be created before adding instances");

    const index = mesh.count;
    mesh.setMatrixAt(index, this.composeInstanceMatrix(config));
    const color = this.getInstanceColor(config) ?? _defaultColor;
    mesh.setColorAt(index, color);
    mesh.count++;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.configs.push(config);

    this.onInstanceAdded(index);

    this.requestUpdate();
    return index;
  }

  /**
   * Remove an instance by index.
   * Uses swap-with-last for O(1) removal. Order is not preserved.
   */
  removeAt(index: number): void {
    const mesh = this.raw;
    invariant(mesh, "Layer must be created before removing instances");

    if (index < 0 || index >= mesh.count) {
      throw new Error(`Index ${index} out of bounds [0, ${mesh.count})`);
    }

    const last = mesh.count - 1;
    if (index !== last) {
      // Swap with last instance
      mesh.getMatrixAt(last, _swapMatrix);
      mesh.setMatrixAt(index, _swapMatrix);

      if (mesh.instanceColor) {
        mesh.getColorAt(last, _swapColor);
        mesh.setColorAt(index, _swapColor);
      }

      this.configs[index] = this.configs[last];
    }

    mesh.count--;
    this.configs.pop();

    this.onInstanceRemoved(index, index === last);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.requestUpdate();
  }

  /** Update an instance at the given index with partial config. */
  updateAt(index: number, config: Partial<ChildConfig>): void {
    const mesh = this.raw;
    invariant(mesh, "Layer must be created before updating instances");

    if (index < 0 || index >= mesh.count) {
      throw new Error(`Index ${index} out of bounds [0, ${mesh.count})`);
    }

    const merged = { ...this.configs[index], ...config };
    mesh.setMatrixAt(index, this.composeInstanceMatrix(merged));
    const color = this.getInstanceColor(merged) ?? _defaultColor;
    mesh.setColorAt(index, color);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.configs[index] = merged;
    this.requestUpdate();
  }

  /** Remove all instances. */
  clear(): void {
    const mesh = this.raw;
    if (mesh) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.requestUpdate();
    }
    this.configs = [];
    this.onInstancesCleared();
  }

  /**
   * Replace all instances in a single batch. More efficient than `clear()` + `add()` loop
   * because it suppresses per-instance update notifications and emits a single update at the end.
   */
  replaceAll(configs: ChildConfig[]): void {
    const mesh = this.raw;
    invariant(mesh, "Layer must be created before replacing instances");

    // Grow capacity if needed
    while (configs.length > this.capacity) {
      this.grow();
    }

    // Re-read after potential grow() which replaces the mesh
    const currentMesh = this.raw;
    invariant(currentMesh, "Layer must be created before replacing instances");
    currentMesh.count = configs.length;

    for (let i = 0; i < configs.length; i++) {
      currentMesh.setMatrixAt(i, this.composeInstanceMatrix(configs[i]));
      const color = this.getInstanceColor(configs[i]) ?? _defaultColor;
      currentMesh.setColorAt(i, color);
    }

    currentMesh.instanceMatrix.needsUpdate = true;
    if (currentMesh.instanceColor) currentMesh.instanceColor.needsUpdate = true;
    this.configs = [...configs];

    this.onInstancesReplaced(configs.length);

    this.requestUpdate();
  }

  /** Number of active instances. */
  get count(): number {
    return this.configs.length;
  }

  // ---------------------------------------------------------------------------
  // Subclass lifecycle hooks — override these to sync external per-instance
  // state (e.g. a PickableInstancedMeshWrapper). Base implementations are
  // intentionally no-ops.
  // ---------------------------------------------------------------------------

  /** Called after a new instance has been appended at `index`. */
  protected onInstanceAdded(_index: number): void {}

  /**
   * Called after an instance at `index` has been removed via swap-with-last.
   * `wasLast` is true if the removed instance was already the last one
   * (no swap happened).
   */
  protected onInstanceRemoved(_index: number, _wasLast: boolean): void {}

  /** Called after all instances have been cleared. */
  protected onInstancesCleared(): void {}

  /** Called after all instances have been replaced; `count` is the new instance count. */
  protected onInstancesReplaced(_count: number): void {}

  /**
   * Called after the underlying `InstancedMesh` has been replaced (capacity grow).
   * `this.raw` already points at the new mesh when this fires.
   */
  protected onInstanceMeshReplaced(
    _newMesh: InstancedMesh<TGeometry, TMaterial>,
  ): void {}

  /**
   * Grow the internal buffers by replacing the InstancedMesh with a larger one.
   * Copies existing instance data to the new mesh.
   */
  private grow(): void {
    const oldMesh = this.raw;
    invariant(oldMesh, "Layer must be created before growing");

    const newCapacity = Math.max(
      this.capacity * GROWTH_FACTOR,
      DEFAULT_CAPACITY,
    );
    const oldCount = oldMesh.count;

    const newMesh = new InstancedMesh(
      oldMesh.geometry,
      oldMesh.material,
      newCapacity,
    );
    newMesh.count = oldCount;

    // Copy instance matrices
    const matrix = new Matrix4();
    for (let i = 0; i < oldCount; i++) {
      oldMesh.getMatrixAt(i, matrix);
      newMesh.setMatrixAt(i, matrix);
    }
    newMesh.instanceMatrix.needsUpdate = true;

    // Copy instance colors if they exist
    if (oldMesh.instanceColor) {
      const color = new ThreeColor();
      for (let i = 0; i < oldCount; i++) {
        oldMesh.getColorAt(i, color);
        newMesh.setColorAt(i, color);
      }
      if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true;
    }

    // Copy transform and visibility
    newMesh.position.copy(oldMesh.position);
    newMesh.rotation.copy(oldMesh.rotation);
    newMesh.scale.copy(oldMesh.scale);
    newMesh.matrix.copy(oldMesh.matrix);
    newMesh.matrixWorld.copy(oldMesh.matrixWorld);
    newMesh.matrixAutoUpdate = oldMesh.matrixAutoUpdate;
    newMesh.matrixWorldAutoUpdate = oldMesh.matrixWorldAutoUpdate;
    newMesh.visible = oldMesh.visible;
    newMesh.castShadow = oldMesh.castShadow;
    newMesh.receiveShadow = oldMesh.receiveShadow;

    // Swap in scene
    const parent = oldMesh.parent;
    if (parent) {
      parent.remove(oldMesh);
      parent.add(newMesh);
    }

    // Dispose old instance buffers (not geometry/material — they're shared)
    oldMesh.dispose();

    this._instance = newMesh;
    this.capacity = newCapacity;

    this.onInstanceMeshReplaced(newMesh);
  }

  override onDestroy(): void {
    const mesh = this.raw;
    if (mesh) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) m.dispose();
      } else {
        mesh.material.dispose();
      }
      mesh.dispose();
    }
    this.configs = [];
    super.onDestroy();
  }
}
