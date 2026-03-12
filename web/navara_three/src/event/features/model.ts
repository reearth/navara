import { ModelMesh as NavaraModelMesh } from "@navara/engine";
import {
  BufferGeometry,
  Points,
  Group,
  Float32BufferAttribute,
  PointsMaterial,
  Box3,
  Vector3,
  Box3Helper,
  Mesh,
  Sphere,
} from "three";

import type { BufferLoader } from "../";
import type { ViewContext } from "../../core";
import { ModelMesh } from "../../mesh/model";
import type { CommonUniforms } from "../../uniforms";
import {
  initializeGltfLoader,
  initializeDracoLoader,
  decompressDraco,
} from "../loaders";

export async function renderModel(
  m: NavaraModelMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewContext: ViewContext,
  layerId: string,
) {
  const loader = initializeGltfLoader(viewContext.concurrencyManager);
  const dracoLoader = initializeDracoLoader(viewContext.concurrencyManager);

  const { rawScene, credit } = await (async () => {
    if (m.bin) {
      const bin = buf.removeU8(m.bin);
      if (!bin) {
        return {};
      }

      if (m.material.__internal__?.pointCloud) {
        let geometry: BufferGeometry | undefined;
        const material = new PointsMaterial({
          size: m.material.pointSize,
          vertexColors: true,
          sizeAttenuation: false,
        });

        if (m.material.__internal__?.dracoCompressed) {
          geometry = await decompressDraco(
            bin.buffer as ArrayBuffer,
            dracoLoader,
          );
        } else {
          geometry = new BufferGeometry();
          geometry.setAttribute(
            "position",
            new Float32BufferAttribute(new Float32Array(bin.buffer), 3),
          );
        }

        const group = new Group();
        if (geometry) {
          const points: Points = new Points(geometry, material);
          group.add(points);

          // Add bounding box helper using the precomputed AABB
          const aabb_center = new Vector3(
            m.aabb.center.x,
            m.aabb.center.y,
            m.aabb.center.z,
          );
          const aabb_extent = new Vector3(
            m.aabb.extent.x,
            m.aabb.extent.y,
            m.aabb.extent.z,
          );

          geometry.boundingBox = new Box3(
            aabb_center.clone().sub(aabb_extent),
            aabb_center.clone().add(aabb_extent),
          );

          geometry.boundingSphere = new Sphere(
            aabb_center,
            aabb_extent.length(),
          );

          if (m.material.showBoundingBox) {
            const boxHelper = new Box3Helper(geometry.boundingBox, 0xff0000);
            group.add(boxHelper);
          }
        }
        return { rawScene: group };
      }

      const model = await loader.parseAsync(bin.buffer as ArrayBuffer, "");
      if (m.material.showBoundingBox) {
        model.scene.traverse((child) => {
          if (child instanceof Mesh) {
            const boxHelper = new Box3Helper(
              child.geometry.boundingBox,
              0x0000ff,
            );
            child.add(boxHelper);
          }
        });
      }
      bin.set([]);

      return {
        rawScene: model.scene,
        credit: model.asset.copyright,
      };
    } else {
      if (!m.material.url) {
        return {};
      }
      let model;
      try {
        model = await loader.loadAsync(m.material.url);
      } catch (e) {
        console.warn(`Failed to load model: ${m.material.url}`, e);
        return {};
      }
      if (m.material.showBoundingBox) {
        model.scene.traverse((child) => {
          if (child instanceof Mesh) {
            const boxHelper = new Box3Helper(
              child.geometry.boundingBox,
              0x0000ff,
            );
            child.add(boxHelper);
          }
        });
      }
      return { rawScene: model.scene };
    }
  })();

  if (!rawScene) {
    return;
  }

  const scene = new ModelMesh(
    { scene: rawScene, credit },
    m,
    uniforms,
    buf,
    viewContext,
    layerId,
  );

  return scene;
}

export function processModelChanged(
  obj: ModelMesh,
  m: NavaraModelMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
