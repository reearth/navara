import { BillboardMesh as NavaraBillboardMesh } from "@navara/engine";

import { setTransform, type BufferLoader } from "../event";
import { applyTextureAspect } from "../texture";

import { BillboardMesh } from "./billboard";
import { InstancedMesh } from "./instanced";

export class InstancedBillboardMesh extends InstancedMesh<BillboardMesh> {
  async _init(m: NavaraBillboardMesh, buf: BufferLoader) {
    await this.initMeshes(m, buf);
  }

  private async initMeshes(m: NavaraBillboardMesh, buf: BufferLoader) {
    const g = m.geometry;
    const batchIdsData = g.batch_ids;
    const batchIds = buf.removeF32(batchIdsData.data);
    const batchIdSize = batchIdsData.size;
    const batchIndexData = g.batch_index;
    const batchIndex = buf.removeU32(batchIndexData.data);
    const positionData = g.position;
    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    if (!batchIds || !batchIndex) return;

    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;
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

    const promises = [];

    for (let i = 0; i < meshLen; i++) {
      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];

      const mesh = new BillboardMesh(this.userData.useRTE);
      mesh.renderOrder = this.renderOrder;

      promises.push(
        mesh._init(material, batchId, active).then(() => {
          const posIdx = i * positionSize;
          if (this.userData.useRTE) {
            if (positionHigh && positionLow) {
              // RTE: Only set scale (for sprite size), not position/rotation
              // Position is encoded in rtePosHigh/Low (absolute world coordinates)
              // Rotation/quaternion would affect matrixWorld and break RTE calculations
              mesh.scale.set(transform.sx, transform.sy, transform.sz);

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
          } else if (position) {
            // RTC: Set mesh position to tile center, store relative offset in uniform
            setTransform(mesh, transform);

            mesh.userData.rtcPos.value.set(
              position[posIdx],
              position[posIdx + 1],
              position[posIdx + 2],
            );
          }

          applyTextureAspect(mesh);

          this.addWithBatchIndex(mesh, batchIndex[i]);
        }),
      );
    }

    await Promise.all(promises);
  }

  async _update(m: NavaraBillboardMesh, buf: BufferLoader, active: boolean) {
    const material = m.material;
    const g = m.geometry;
    const transform = m.transform;

    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    const positionData = g.position;
    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    let positionSize = 0;
    if (positionHighData) {
      positionSize = positionHighData.size;
    } else if (positionData) {
      positionSize = positionData.size;
    }

    await Promise.all(
      this.meshes().map(async (mesh) => {
        await mesh._update(material, active);

        const batchIdx = mesh.userData.batchIndex as number;
        const posIdx = batchIdx * positionSize;

        if (this.userData.useRTE) {
          // RTE: Only update scale (for sprite size), not position/rotation
          mesh.scale.set(transform.sx, transform.sy, transform.sz);
          applyTextureAspect(mesh);

          if (positionHigh && positionLow) {
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
        } else {
          setTransform(mesh, transform);
          applyTextureAspect(mesh);
          if (position) {
            mesh.userData.rtcPos.value.set(
              position[posIdx],
              position[posIdx + 1],
              position[posIdx + 2],
            );
          }
        }
      }),
    );
  }
}
