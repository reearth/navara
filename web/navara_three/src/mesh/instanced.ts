import { Color, Mesh, Object3D } from "three";

import { isFeatureMesh } from "./featureMesh";
import type { PickableMesh } from "./pickableMesh";

export type InstancedMeshOptions = {
  renderOrder?: number;
};

// This is used for point related mesh like point, billboard and text.
export class InstancedMesh<M extends Object3D>
  extends Mesh
  implements PickableMesh
{
  constructor(options?: InstancedMeshOptions) {
    super();
    this.renderOrder = options?.renderOrder ?? this.renderOrder;
  }

  addWithBatchIndex(m: M, batchIndex: number) {
    m.userData.batchIndex = batchIndex;
    this.add(m);
  }

  meshes() {
    return this.children as M[];
  }

  getMeshByBatchIndex(batchIndex: number) {
    return this.meshes()[batchIndex];
  }

  setFeatureColorByBatchIndex(batchIndex: number, color: Color) {
    const mesh = this.getMeshByBatchIndex(batchIndex);

    if (!isFeatureMesh(mesh))
      throw new Error(`Mesh doesn't support FeatureMesh`);

    mesh._setFeatureColor(color);
  }

  setFeatureShowByBatchIndex(batchIndex: number, visible: boolean) {
    const mesh = this.getMeshByBatchIndex(batchIndex);

    if (!isFeatureMesh(mesh))
      throw new Error(`Mesh doesn't support FeatureMesh`);

    mesh._setFeatureShow(visible);
  }

  _setPickable(pickable: boolean) {
    const v = pickable ? 1.0 : 0.0;
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
}
