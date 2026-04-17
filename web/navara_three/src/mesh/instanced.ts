import { Color, Mesh, Object3D } from "three";

import { isFeatureMesh } from "./featureMesh";
import type { PickableMesh } from "./pickableMesh";

export type InstancedMeshOptions = {
  renderOrder?: number;
  layerId: string;
};

// This is used for point related mesh like point, billboard and text.
export class InstancedMesh<M extends Object3D>
  extends Mesh
  implements PickableMesh
{
  visibleMeshes = new Set();
  allMeshes: M[] = [];
  active = false;

  constructor(options: InstancedMeshOptions) {
    super();
    this.renderOrder = options.renderOrder ?? this.renderOrder;
  }

  // This is used to keep rendering the parent tile while the child tiles are being prepared.
  setActive(active: boolean) {
    this.active = active;
    this.visible = active;
  }

  addWithBatchIndex(m: M, batchIndex: number) {
    m.userData.batchIndex = batchIndex;

    // Manage `mesh` manually, since Three.js traverses all children.
    this.allMeshes.push(m);

    this.markVisibility(m);
  }

  markVisibility(m: M) {
    // Avoid adding this mesh to `Mesh.children` if the mesh is invisible,
    // since Three.js traverses all `Mesh.children` on every frame to decide whether the mesh is rendered or not.
    if (m.visible && !this.visibleMeshes.has(m.id)) {
      this.add(m);
      this.visibleMeshes.add(m.id);
    } else if (!m.visible && this.visibleMeshes.has(m.id)) {
      this.remove(m);
      this.visibleMeshes.delete(m.id);
    }
  }

  meshes() {
    return this.allMeshes;
  }

  getMeshByBatchIndex(batchIndex: number) {
    return this.meshes()[batchIndex];
  }

  setFeatureColorByBatchIndex(batchIndex: number, color: Color) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (!mesh) return;

    if (!isFeatureMesh(mesh))
      throw new Error(`Mesh doesn't support FeatureMesh`);

    mesh._setFeatureColor(color);
  }

  setFeatureShowByBatchIndex(batchIndex: number, rawVisible: boolean) {
    const visible = this.active && rawVisible;
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (!mesh) return;

    if (!isFeatureMesh(mesh))
      throw new Error(`Mesh doesn't support FeatureMesh`);

    mesh._setFeatureShow(visible);

    this.markVisibility(mesh);
  }

  setFeatureHeightByBatchIndex(batchIndex: number, height: number) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (!mesh) return;

    if (!isFeatureMesh(mesh))
      throw new Error(`Mesh doesn't support FeatureMesh`);

    mesh._setFeatureHeight(height);
  }

  onBeforePicking() {
    this.setPickable(1.0);
  }

  onAfterPicking() {
    this.setPickable(0.0);
  }

  private setPickable(v: number) {
    for (const mesh of this.meshes()) {
      mesh.userData.uPickable.value = v;

      if (isFeatureMesh(mesh)) {
        // The frustum used for picking is only 1 pixel in size,
        // and both the text and its background dynamically change positions,
        // they risk being incorrectly culled. Therefore, frustumCulled must be set to false
        mesh._setFrustumCulled(v < 0.5);
      }
    }
  }

  _getRenderable(): Object3D {
    return this;
  }
}
