import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { ViewContext } from "../core";
import { setTransform, type BufferLoader } from "../event";
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
  /** ViewContext for PostEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for PostEffect handling */
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
    const positionData = g.position;
    const position = buf.removeF32(positionData.data);
    const positionSize = positionData.size;
    const batchIdsData = g.batch_ids;
    const batchIds = buf.removeF32(batchIdsData.data);
    const batchIdSize = batchIdsData.size;
    const batchIndexData = g.batch_index;
    const batchIndex = buf.removeU32(batchIndexData.data);
    if (!position || !batchIds || !batchIndex) return;

    const material = m.material;
    const active = m.active;
    const transform = m.transform;

    const meshLen = position.length / positionSize;

    for (let i = 0; i < meshLen; i++) {
      const posIdx = i * positionSize;
      // x, y, z are relative coordinates (small numbers, maintain precision)
      const x = position[posIdx];
      const y = position[posIdx + 1];
      const z = position[posIdx + 2];

      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];

      const mesh = new PointMesh(material, batchId, active);
      mesh.renderOrder = this.renderOrder;

      // RTC: Set mesh position to tile center, store relative offset in uniform
      setTransform(mesh, transform);

      mesh.userData.rtcPos.value.set(x, y, z);

      this.addWithBatchIndex(mesh, batchIndex[i]);
    }
  }

  _update(m: NavaraPointMesh, buf: BufferLoader, active: boolean) {
    const material = m.material;

    const g = m.geometry;
    const positionData = g.position;
    const position = buf.removeF32(positionData.data);
    const positionSize = positionData.size;

    const transform = m.transform;

    for (const mesh of this.meshes()) {
      mesh._update(material, active);

      // RTC: Update transform (tile center)
      setTransform(mesh, transform);

      if (position) {
        const batchIndex = (mesh.userData.batchIndex as number) * positionSize;
        // x, y, z are relative coordinates
        const x = position[batchIndex];
        const y = position[batchIndex + 1];
        const z = position[batchIndex + 2];

        // Update relative offset uniform
        mesh.userData.rtcPos.value.set(x, y, z);
      }
    }

    // PostEffect: effectIds handling at container level
    // SpriteMaterial doesn't support emissive, so only effectIds is handled
    const ud = this.userData as InstancedPointUserData;
    ud.prev ??= {};
    if (!arraysEqual(ud.prev.effectIds, material.effectIds)) {
      this._viewContext.postEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        ud.prev.effectIds ?? [],
        this._layerId,
      );
      ud.prev.effectIds = material.effectIds ? [...material.effectIds] : [];
    }
  }
}
