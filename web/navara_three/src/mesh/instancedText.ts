import { TextMesh as NavaraTextMesh } from "@navara/engine";

import { type BufferLoader } from "../event";
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

    this.userData.useRTE =
      g.position_3d_high !== undefined && g.position_3d_high.size > 0;

    let meshLen = 0;
    let positionSize = 0;
    if (positionHigh && positionHighData) {
      positionSize = positionHighData.size;
      meshLen = positionHigh.length / positionSize;
    } else if (position && positionData) {
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

  _update(
    m: NavaraTextMesh,
    buf: BufferLoader,
    active: boolean,
    needRender?: () => void,
  ) {
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

    for (const mesh of this.meshes()) {
      mesh._updateTextByMaterial(material, active, needRender);

      const batchIndex = mesh.userData.batchIndex as number;
      const posIdx = batchIndex * positionSize;

      mesh.setPosition(
        this.userData.useRTE,
        position,
        positionHigh,
        positionLow,
        posIdx,
        transform,
      );
    }
  }

  setTextByNatchIndex(batchIndex: number, text: string) {
    this.getMeshByBatchIndex(batchIndex).setText(text);
  }
}
