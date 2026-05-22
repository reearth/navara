import type { BaseEventMap, XYZ } from "@navara/core";
import {
  BufferGeometry,
  Color as ThreeColor,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { NodeMaterial } from "three/webgpu";
import invariant from "tiny-invariant";

import { PickableInstancedNodeMaterialWrapper } from "../nodes/setupNodeMaterialForPicking";

import {
  MeshDescBase,
  type MeshDescBaseConfig,
  type MeshDescBaseUpdate,
} from "./MeshDescBase";

/** Constructor-time config for {@link NewInstancedMeshDesc} subclasses. */
export type NewInstancedMeshConfig = MeshDescBaseConfig;
/** Post-creation update payload for {@link NewInstancedMeshDesc} subclasses. */
export type NewInstancedMeshUpdate = MeshDescBaseUpdate;

// These aliases survive the eventual `NewInstancedMeshDesc` →
// `InstancedMeshDesc` rename.

/** Alias of {@link NewInstancedMeshConfig}. */
export type InstancedMeshDescConfig = NewInstancedMeshConfig;
/** Alias of {@link NewInstancedMeshUpdate}. */
export type InstancedMeshDescUpdate = NewInstancedMeshUpdate;

/** Per-instance transform fields for one child of an instanced descriptor. */
export type NewInstancedChildConfig = {
  position?: XYZ;
  rotation?: XYZ;
  scale?: XYZ;
  matrix?: Matrix4;
};

/** Alias of {@link NewInstancedChildConfig}. */
export type InstancedMeshDescChildConfig = NewInstancedChildConfig;

const DEFAULT_CAPACITY = 64;
const GROWTH_FACTOR = 2;

const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3();
const _euler = new Euler();
const _matrix = new Matrix4();
const _defaultColor = new ThreeColor(0xffffff);
const _swapMatrix = new Matrix4();
const _swapColor = new ThreeColor();

/**
 * Successor to `InstancedMeshDesc` for NodeMaterial-based instanced meshes.
 * Adds per-instance picking on top of {@link MeshDescBase}.
 */
export abstract class NewInstancedMeshDesc<
  TGeometry extends BufferGeometry = BufferGeometry,
  TMaterial extends NodeMaterial = NodeMaterial,
  Config extends NewInstancedMeshConfig = NewInstancedMeshConfig,
  UpdateConfig extends NewInstancedMeshUpdate = NewInstancedMeshUpdate,
  ChildConfig extends NewInstancedChildConfig = NewInstancedChildConfig,
  CustomEvent extends BaseEventMap = BaseEventMap,
> extends MeshDescBase<
  Config,
  UpdateConfig,
  InstancedMesh<TGeometry, TMaterial>,
  CustomEvent
> {
  protected configs: ChildConfig[] = [];
  private capacity = 0;

  protected pickWrapper?: PickableInstancedNodeMaterialWrapper;

  /** Factory for the shared instanced geometry. */
  protected abstract createGeometry(): TGeometry;
  /** Factory for the shared instanced NodeMaterial. */
  protected abstract createMaterial(): TMaterial;
  /** Initial per-instance child configs used in `createMesh`. */
  protected abstract getChildConfigs(): ChildConfig[];
  /** Resolve a per-instance color, or undefined to use the default. */
  protected abstract getInstanceColor(
    config: ChildConfig,
  ): ThreeColor | undefined;

  /** Per-instance batch IDs when picking is enabled. */
  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
  }

  /**
   * Compose the instance matrix for one child. Override {@link getInstanceScale}
   * to fold geometry dimensions into scale.
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

  /** Resolve the scale Vector3 for one instance. Override to fold in geometry size. */
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

  override onCreate(): void {
    super.onCreate();
    if (!this.pickingEnabled) return;

    const mesh = this.raw;
    if (!mesh) return;

    // Must run after `super.onCreate()` so the mesh exists; the assignment
    // re-triggers `setupNodeMaterial` to splice the picking wrapper in.
    this.pickWrapper = new PickableInstancedNodeMaterialWrapper(
      mesh,
      this.count,
      this.ctx,
    );
    this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    this.colorOutputNode = this.pickWrapper.wrapColor(this.colorOutputNode);
  }

  /** Returns the index of the added instance. */
  add(config: ChildConfig): number {
    const count = this.raw?.count ?? 0;
    if (count >= this.capacity) {
      this.grow();
    }

    const mesh = this.raw;
    invariant(mesh, "Descriptor must be created before adding instances");

    const index = mesh.count;
    mesh.setMatrixAt(index, this.composeInstanceMatrix(config));
    const color = this.getInstanceColor(config) ?? _defaultColor;
    mesh.setColorAt(index, color);
    mesh.count++;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.configs.push(config);

    this.pickWrapper?.addInstance();

    this.requestUpdate();
    return index;
  }

  /** Remove the instance at {@link index}; swaps the last instance into its slot. */
  removeAt(index: number): void {
    const mesh = this.raw;
    invariant(mesh, "Descriptor must be created before removing instances");

    if (index < 0 || index >= mesh.count) {
      throw new Error(`Index ${index} out of bounds [0, ${mesh.count})`);
    }

    const last = mesh.count - 1;
    if (index !== last) {
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

    this.pickWrapper?.removeInstanceAt(index);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.requestUpdate();
  }

  /** Merge {@link config} into the instance at {@link index} and re-apply it. */
  updateAt(index: number, config: Partial<ChildConfig>): void {
    const mesh = this.raw;
    invariant(mesh, "Descriptor must be created before updating instances");

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

  /** Remove every instance (keeps allocated capacity). */
  clear(): void {
    const mesh = this.raw;
    if (mesh) {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.requestUpdate();
    }
    this.configs = [];
    this.pickWrapper?.clearInstances();
  }

  /** Replace all instances with the given child configs (grows capacity as needed). */
  replaceAll(configs: ChildConfig[]): void {
    const mesh = this.raw;
    invariant(mesh, "Descriptor must be created before replacing instances");

    while (configs.length > this.capacity) {
      this.grow();
    }

    const currentMesh = this.raw;
    invariant(
      currentMesh,
      "Descriptor must be created before replacing instances",
    );
    currentMesh.count = configs.length;

    for (let i = 0; i < configs.length; i++) {
      currentMesh.setMatrixAt(i, this.composeInstanceMatrix(configs[i]));
      const color = this.getInstanceColor(configs[i]) ?? _defaultColor;
      currentMesh.setColorAt(i, color);
    }

    currentMesh.instanceMatrix.needsUpdate = true;
    if (currentMesh.instanceColor) currentMesh.instanceColor.needsUpdate = true;
    this.configs = [...configs];

    this.pickWrapper?.replaceAll(configs.length);

    this.requestUpdate();
  }

  /** Number of live instances. */
  get count(): number {
    return this.configs.length;
  }

  // Replaces the InstancedMesh with a larger one and re-attaches the picking
  // attribute, since the attribute is bound to the (now-replaced) geometry.
  private grow(): void {
    const oldMesh = this.raw;
    invariant(oldMesh, "Descriptor must be created before growing");

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

    const matrix = new Matrix4();
    for (let i = 0; i < oldCount; i++) {
      oldMesh.getMatrixAt(i, matrix);
      newMesh.setMatrixAt(i, matrix);
    }
    newMesh.instanceMatrix.needsUpdate = true;

    if (oldMesh.instanceColor) {
      const color = new ThreeColor();
      for (let i = 0; i < oldCount; i++) {
        oldMesh.getColorAt(i, color);
        newMesh.setColorAt(i, color);
      }
      if (newMesh.instanceColor) newMesh.instanceColor.needsUpdate = true;
    }

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

    const parent = oldMesh.parent;
    if (parent) {
      parent.remove(oldMesh);
      parent.add(newMesh);
    }

    oldMesh.dispose();

    this._instance = newMesh;
    this.capacity = newCapacity;

    this.pickWrapper?.syncMesh(newMesh);
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }

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
