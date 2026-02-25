import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import { type BufferLoader } from "../event";
import type { FontManager } from "../font/FontManager";
import type { CommonUniforms } from "../uniforms";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import { SDFTextMesh } from "./sdfText";

export class InstancedSdfTextMesh extends InstancedMesh<SDFTextMesh> {
  private _fontUrl: string;

  constructor(
    m: NavaraTextMesh,
    buf: BufferLoader,
    fontManager: FontManager,
    fontUrl: string,
    uniforms: CommonUniforms,
    options: InstancedMeshOptions,
  ) {
    super(options);
    this._fontUrl = fontUrl;
    this.initMeshes(m, buf, fontManager, uniforms);
  }

  get fontUrl(): string {
    return this._fontUrl;
  }

  private initMeshes(
    m: NavaraTextMesh,
    buf: BufferLoader,
    fontManager: FontManager,
    uniforms: CommonUniforms,
  ) {
    const g = m.geometry;
    const batchIdsData = g.batch_ids;
    const batchIds = buf.removeF32(batchIdsData.data);
    const batchIdSize = batchIdsData.size;
    const batchIndexData = g.batch_index;
    const batchIndex = buf.removeU32(batchIndexData.data);
    if (!batchIds || !batchIndex) return;

    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    const material = m.material;
    const active = m.active;
    const transform = m.transform;

    this.setActive(active);

    let meshLen = 0;
    let positionSize = 0;
    if (positionData) {
      positionSize = positionData.size;
      meshLen = (position?.length ?? 0) / positionSize;
    }

    for (let i = 0; i < meshLen; i++) {
      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];
      const posIdx = i * positionSize;

      const mesh = new SDFTextMesh(fontManager, this._fontUrl, uniforms, batchId);
      mesh.renderOrder = this.renderOrder;
      mesh.updateFromMaterial(material, active);
      mesh.setPosition(position, posIdx, transform);

      this.addWithBatchIndex(mesh, batchIndex[i]);
    }
  }

  _update(
    m: NavaraTextMesh,
    buf: BufferLoader,
    active: boolean,
    needRender?: () => void,
  ) {
    this.setActive(true);

    const material = m.material;
    const g = m.geometry;
    const transform = m.transform;

    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    let positionSize = 0;
    if (positionData) {
      positionSize = positionData.size;
    }

    for (const mesh of this.meshes()) {
      mesh.updateFromMaterial(material, active);
      this.markVisibility(mesh);

      const batchIndex = mesh.userData.batchIndex as number;
      const posIdx = batchIndex * positionSize;

      mesh.setPosition(position, posIdx, transform);
    }

    if (needRender) needRender();
  }

  override _setPickable(pickable: boolean) {
    for (const mesh of this.meshes()) {
      mesh._setPickable(pickable);
    }
  }
}
