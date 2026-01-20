import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { ViewContext } from "../core";
import { type BufferLoader } from "../event";
import { arraysEqual } from "../utils";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import { PointMesh } from "./point";

/** UserData type for InstancedPointMesh */
type InstancedPointUserData = {
  prev?: {
    effectIds?: string[];
  };
};

export class InstancedPointMesh extends InstancedMesh<PointMesh> {
  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;

  constructor(
    m: NavaraPointMesh,
    buf: BufferLoader,
    options: InstancedMeshOptions,
  ) {
    super(options);
    this._viewContext = options.viewContext;
    this._layerId = options.layerId;

    this.initMeshes(m, buf);
  }

  private initMeshes(m: NavaraPointMesh, buf: BufferLoader) {
    const g = m.geometry;
    const batchIdsData = g.batch_ids;
    const batchIds = buf.removeF32(batchIdsData.data);
    const batchIdSize = batchIdsData.size;
    const batchIndexData = g.batch_index;
    const batchIndex = buf.removeU32(batchIndexData.data);
    if (!batchIds || !batchIndex) return;

    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;
    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    const material = m.material;
    const active = m.active;
    const transform = m.transform;

    this.userData.useRTE =
      g.position_3d_high !== undefined && g.position_3d_high.size > 0;

    let meshLen = 0;
    let positionSize = 0;

    if (this.userData.useRTE) {
      if (!positionHigh || !positionLow || !positionHighData) return;
      positionSize = positionHighData.size;

      meshLen = positionHigh.length / positionSize;
    } else {
      if (!position || !positionData) return;
      positionSize = positionData.size;

      meshLen = position.length / positionSize;
    }

    for (let i = 0; i < meshLen; i++) {
      const posIdx = i * positionSize;
      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];

      const mesh = new PointMesh(
        material,
        batchId,
        active,
        this.userData.useRTE,
      );
      mesh.renderOrder = this.renderOrder;
      mesh.setPosition(
        this.userData.useRTE,
        position,
        positionHigh,
        positionLow,
        posIdx,
        transform,
      );
      this.addWithBatchIndex(mesh, batchIndex[i]);
    }
  }

  _update(m: NavaraPointMesh, buf: BufferLoader, active: boolean) {
    const material = m.material;
    const g = m.geometry;
    const transform = m.transform;

    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;
    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    let positionSize = 0;
    if (positionHighData) {
      positionSize = positionHighData.size;
    } else if (positionData) {
      positionSize = positionData.size;
    }

    for (const mesh of this.meshes()) {
      mesh._update(material, active);

      const posIdx = mesh.userData.batchIndex * positionSize;
      mesh.setPosition(
        this.userData.useRTE,
        position,
        positionHigh,
        positionLow,
        posIdx,
        transform,
      );
    }

    // SelectiveEffect: effectIds handling at container level
    // SpriteMaterial doesn't support emissive, so only effectIds is handled
    const ud = this.userData as InstancedPointUserData;
    ud.prev ??= {};
    if (!arraysEqual(ud.prev.effectIds, material.effectIds)) {
      this._viewContext.selectiveEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        ud.prev.effectIds ?? [],
        this._layerId,
      );
      ud.prev.effectIds = material.effectIds ? [...material.effectIds] : [];
    }
  }
}
