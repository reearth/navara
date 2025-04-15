import { Color, Mesh, Object3D } from "three";

import { isFeatureMesh } from "./featureMesh";

export type InstancedMeshOptions = {
  renderOrder?: number;
};

// This is used for point related mesh like point, billboard and text.
export class InstancedMesh<M extends Object3D> extends Mesh {
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

  setPickable(v: number) {
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

  pick(pickedBatchIds: Set<number>, highlightColor: Color) {
    for (const mesh of this.meshes()) {
      const batchId = mesh.userData.batchId;
      const isPicked = pickedBatchIds.has(batchId);
      if (isPicked) {
        pickedBatchIds.delete(batchId);
      }

      if (!isFeatureMesh(mesh)) continue;

      if (mesh.userData.isPicked !== isPicked) {
        mesh.userData.isPicked = isPicked;
        if (isPicked) {
          mesh.userData.orgColor = mesh._getFeatureColor().clone();
          mesh._setFeatureColor(highlightColor);
        } else {
          mesh._setFeatureColor(mesh.userData.orgColor);
        }
      }
    }
  }
}
