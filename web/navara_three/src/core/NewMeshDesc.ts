import type { BaseEventMap } from "@navara/core";
import type { Object3D } from "three";

import { PickableNodeMaterialWrapper } from "../nodes/setupNodeMaterialForPicking";

import {
  MeshDescBase,
  type MeshDescBaseConfig,
  type MeshDescBaseInstance,
  type MeshDescBaseUpdate,
} from "./MeshDescBase";

// These aliases survive the eventual `NewMeshDesc` → `MeshDesc` rename, so
// subclasses can import them now and avoid follow-up churn.

/** Constructor-time config for {@link NewMeshDesc} subclasses. */
export type MeshDescConfig = MeshDescBaseConfig;
/** Post-creation update payload for {@link NewMeshDesc} subclasses. */
export type MeshDescUpdate = MeshDescBaseUpdate;
/** Underlying Three.js instance shape for {@link NewMeshDesc}. */
export type MeshDescInstance<I extends object = object> =
  MeshDescBaseInstance<I>;

/**
 * Successor to `MeshDesc` / `MeshDescWithSelectiveEffect` for single
 * {@link Mesh}es with NodeMaterial. Adds single-batchId picking on top of
 * {@link MeshDescBase}.
 */
export abstract class NewMeshDesc<
  Config extends MeshDescBaseConfig = MeshDescBaseConfig,
  UpdateConfig extends MeshDescBaseUpdate = MeshDescBaseUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends MeshDescBaseInstance<InstanceObj> =
    MeshDescBaseInstance<InstanceObj>,
> extends MeshDescBase<
  Config,
  UpdateConfig,
  InstanceObj,
  CustomEvent,
  Instance
> {
  protected pickWrapper?: PickableNodeMaterialWrapper;

  /** Batch ID assigned to this mesh when picking is enabled. */
  get batchId(): number | undefined {
    return this.pickWrapper?.batchId;
  }

  override onCreate(): void {
    super.onCreate();
    if (!this.pickingEnabled) return;

    const mesh = this.raw;
    if (!mesh) return;

    // Must run after `super.onCreate()` so the mesh exists; the assignment
    // re-triggers `setupNodeMaterial` to splice the picking wrapper in.
    this.pickWrapper = new PickableNodeMaterialWrapper(mesh, this.ctx);
    this.ctx.registerPickableMesh(this.id, this.pickWrapper);
    this.colorOutputNode = this.pickWrapper.wrapColor(this.colorOutputNode);
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }
    super.onDestroy();
  }
}
