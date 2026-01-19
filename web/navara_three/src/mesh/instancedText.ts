import { TextMesh as NavaraTextMesh } from "@navara/engine";

import { setTransform, type BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import { TextMesh } from "./text";

export class InstancedTextMesh extends InstancedMesh<TextMesh> {
  constructor(
    m: NavaraTextMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
    options: InstancedMeshOptions,
  ) {
    super(options);

    this.initMeshes(m, buf, uniforms);
  }

  private initMeshes(
    m: NavaraTextMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
  ) {
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
      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];
      const posIdx = i * positionSize;

      const mesh = new TextMesh(
        material,
        uniforms,
        batchId,
        this.userData.useRTE,
      );
      mesh.renderOrder = this.renderOrder;
      mesh._updateTextByMaterial(material, active);

      if (this.userData.useRTE) {
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
      } else if (position) {
        setTransform(mesh, transform);
        mesh.userData.rtcPos.value.set(
          position[posIdx],
          position[posIdx + 1],
          position[posIdx + 2],
        );
      }

      this.addWithBatchIndex(mesh, batchIndex[i]);
    }
  }

  _update(
    m: NavaraTextMesh,
    buf: BufferLoader,
    active: boolean,
    needRender?: () => void,
  ) {
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
        mesh._updateTextByMaterial(material, active, needRender);

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
        mesh._updateTextByMaterial(material, active, needRender);

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
  }

  setTextByBatchIndex(batchIndex: number, text: string) {
    this.getMeshByBatchIndex(batchIndex)?.setText(text);
  }
}
