import { TextMesh as NavaraTextMesh } from "@navara/engine";

import { setTransform, type BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";

import { InstancedMesh } from "./instanced";
import { TextMesh } from "./text";

export class InstancedTextMesh extends InstancedMesh<TextMesh> {
  constructor(m: NavaraTextMesh, buf: BufferLoader, uniforms: CommonUniforms) {
    super();

    this.initMeshes(m, buf, uniforms);
  }

  private initMeshes(
    m: NavaraTextMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
  ) {
    const g = m.geometry;
    const positionData = g.position;
    const position = buf.removeF32(positionData.data);
    const positionSize = positionData.size;
    const batchIdAndSelData = g.batch_id_and_sel;
    const batchIdAndSel = buf.removeF32(batchIdAndSelData.data);
    const batchIdSize = batchIdAndSelData.size;
    const batchIndexData = g.batch_index;
    const batchIndex = buf.removeU32(batchIndexData.data);
    if (!position || !batchIdAndSel || !batchIndex) return;

    const material = m.material;
    const active = m.active;
    const transform = m.transform;

    const meshLen = position.length / positionSize;

    for (let i = 0; i < meshLen; i++) {
      const posIdx = i * positionSize;
      const x = position[posIdx];
      const y = position[posIdx + 1];
      const z = position[posIdx + 2];

      const batchIdIdx = i * batchIdSize;
      const batchId = batchIdAndSel[batchIdIdx];
      const selected = !!batchIdAndSel[batchIdIdx + 1];

      const mesh = new TextMesh(material, uniforms, batchId, selected);
      mesh._updateTextByMaterial(material, active);

      setTransform(mesh, transform);
      mesh.position.set(x, y, z);

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
    const positionData = g.position;
    const position = buf.removeF32(positionData.data);
    const positionSize = positionData.size;

    const transform = m.transform;

    for (const mesh of this.meshes()) {
      mesh._updateTextByMaterial(material, active, needRender);

      setTransform(mesh, transform, true);

      if (position) {
        const batchIndex = (mesh.userData.batchIndex as number) * positionSize;
        const x = position[batchIndex];
        const y = position[batchIndex + 1];
        const z = position[batchIndex + 2];
        mesh.position.set(x, y, z);
      }
    }
  }

  setTextByNatchIndex(batchIndex: number, text: string) {
    this.getMeshByBatchIndex(batchIndex).setText(text);
  }
}
