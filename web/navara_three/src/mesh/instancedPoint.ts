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

    this.setActive(active);

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

      if (this.userData.useRTE) {
        if (positionHigh && positionLow) {
          const mesh = new PointMesh(material, batchId, active, true); // Pass useRTE = true
          mesh.renderOrder = this.renderOrder;

          // RTE: Only set scale (for sprite size), not position/rotation
          // Position is encoded in rtePosHigh/Low (absolute world coordinates)
          // Rotation/quaternion would affect matrixWorld and break RTE calculations
          mesh.scale.set(transform.sx, transform.sy, transform.sz);

          // Set high and low components separately - shader will combine
          mesh.userData.rtePosHigh.value.set(
            positionHigh[posIdx],
            positionHigh[posIdx + 1],
            positionHigh[posIdx + 2],
          );
          mesh.userData.rtePosLow.value.set(
            positionLow[posIdx],
            positionLow[posIdx + 1],
            positionLow[posIdx + 2],
          );

          this.addWithBatchIndex(mesh, batchIndex[i]);
        }
      } else if (position) {
        const mesh = new PointMesh(material, batchId, active, false); // Pass useRTE = false
        mesh.renderOrder = this.renderOrder;

        // RTC: Set mesh position to tile center, store relative offset in uniform
        setTransform(mesh, transform);

        mesh.userData.rtcPos.value.set(
          position[posIdx],
          position[posIdx + 1],
          position[posIdx + 2],
        );

        this.addWithBatchIndex(mesh, batchIndex[i]);
      }
    }
  }

  _update(m: NavaraPointMesh, buf: BufferLoader, active: boolean) {
    this.setActive(active);

    const material = m.material;
    const g = m.geometry;
    const transform = m.transform;

    if (this.userData.useRTE) {
      const positionHighData = g.position_3d_high;
      const positionLowData = g.position_3d_low;
      const positionHigh = positionHighData
        ? buf.removeF32(positionHighData.data)
        : undefined;
      const positionLow = positionLowData
        ? buf.removeF32(positionLowData.data)
        : undefined;
      const positionSize = positionHighData?.size ?? 0;

      for (const mesh of this.meshes()) {
        mesh._update(material, active);

        // RTE: Only update scale (for sprite size), not position/rotation
        mesh.scale.set(transform.sx, transform.sy, transform.sz);

        if (positionHigh && positionLow) {
          const batchIndex = mesh.userData.batchIndex as number;
          const posIdx = batchIndex * positionSize;

          // Update high and low separately - shader will combine
          mesh.userData.rtePosHigh.value.set(
            positionHigh[posIdx],
            positionHigh[posIdx + 1],
            positionHigh[posIdx + 2],
          );
          mesh.userData.rtePosLow.value.set(
            positionLow[posIdx],
            positionLow[posIdx + 1],
            positionLow[posIdx + 2],
          );
        }
      }
    } else {
      // RTC mode: relative coordinates
      const positionData = g.position;
      const position = positionData
        ? buf.removeF32(positionData.data)
        : undefined;
      const positionSize = positionData?.size ?? 0;

      for (const mesh of this.meshes()) {
        mesh._update(material, active);
        setTransform(mesh, transform);

        if (position) {
          const batchIndex = mesh.userData.batchIndex as number;
          const posIdx = batchIndex * positionSize;

          // Update relative offset uniform
          mesh.userData.rtcPos.value.set(
            position[posIdx],
            position[posIdx + 1],
            position[posIdx + 2],
          );
        }
      }
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
