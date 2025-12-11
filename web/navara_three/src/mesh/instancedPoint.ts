import { PointMesh as NavaraPointMesh } from "@navara/engine";

import type { ViewContext } from "../core";
import { updatePostEffectLinksForObject } from "../core/PostEffectHelper";
import { setTransform, type BufferLoader } from "../event";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import { PointMesh } from "./point";

function arraysEqual(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export class InstancedPointMesh extends InstancedMesh<PointMesh> {
  constructor(
    m: NavaraPointMesh,
    buf: BufferLoader,
    options?: InstancedMeshOptions,
  ) {
    super(options);

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
      const x = position[posIdx];
      const y = position[posIdx + 1];
      const z = position[posIdx + 2];

      const batchIdIdx = i * batchIdSize;
      const batchId = batchIds[batchIdIdx];

      const mesh = new PointMesh(material, batchId, active);
      mesh.renderOrder = this.renderOrder;

      setTransform(mesh, transform);
      mesh.position.set(x, y, z);

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

      setTransform(mesh, transform, true);

      if (position) {
        const batchIndex = (mesh.userData.batchIndex as number) * positionSize;
        const x = position[batchIndex];
        const y = position[batchIndex + 1];
        const z = position[batchIndex + 2];
        mesh.position.set(x, y, z);
      }
    }

    // PostEffect: effectIds handling at container level
    // SpriteMaterial doesn't support emissive, so only effectIds is handled
    if (!this.userData.prev) {
      this.userData.prev = {};
    }
    const prev = this.userData.prev as { effectIds?: string[] };
    const viewContext = this.userData.viewContext as ViewContext | undefined;
    const layerId = this.userData.layerId as string | undefined;
    if (layerId && !arraysEqual(prev.effectIds, material.effectIds)) {
      updatePostEffectLinksForObject(
        this,
        viewContext?.postEffectRegistry,
        material.effectIds ?? [],
        prev.effectIds ?? [],
        layerId,
      );
      prev.effectIds = material.effectIds ? [...material.effectIds] : [];
    }
  }
}
