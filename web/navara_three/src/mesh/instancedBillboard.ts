import { BillboardMesh as NavaraBillboardMesh } from "@navara/engine";

import { setTransform, type BufferLoader } from "../event";
import { applyTextureAspect } from "../texture";
import type { CommonUniforms } from "../uniforms";

import { BillboardMesh } from "./billboard";
import { InstancedMesh } from "./instanced";

export class InstancedBillboardMesh extends InstancedMesh<BillboardMesh> {
  async _init(
    m: NavaraBillboardMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
  ) {
    await this.initMeshes(m, buf, uniforms);
  }

  private async initMeshes(
    m: NavaraBillboardMesh,
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

    const promises = [];

    for (let i = 0; i < meshLen; i++) {
      const posIdx = i * positionSize;
      const x = position[posIdx];
      const y = position[posIdx + 1];
      const z = position[posIdx + 2];

      const batchIdIdx = i * batchIdSize;
      const batchId = batchIdAndSel[batchIdIdx];
      const selected = !!batchIdAndSel[batchIdIdx + 1];

      const mesh = new BillboardMesh();

      promises.push(
        mesh._init(material, uniforms, batchId, selected, active).then(() => {
          setTransform(mesh, transform);
          mesh.position.set(x, y, z);

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
    const positionData = g.position;
    const position = buf.removeF32(positionData.data);
    const positionSize = positionData.size;

    const transform = m.transform;

    await Promise.all(
      this.meshes().map(async (mesh) => {
        await mesh._update(material, active);

        setTransform(mesh, transform, true);
        applyTextureAspect(mesh);

        if (position) {
          const batchIndex =
            (mesh.userData.batchIndex as number) * positionSize;
          const x = position[batchIndex];
          const y = position[batchIndex + 1];
          const z = position[batchIndex + 2];
          mesh.position.set(x, y, z);
        }
      }),
    );
  }
}
