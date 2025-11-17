import type { EventHandler } from "@navara/core";
import { ModelMesh as NavaraModelMesh } from "@navara/engine";
import type { AnimationClip } from "three";
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
} from "three";

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
import { ModelMesh } from "../../mesh/model";
import type { CommonUniforms } from "../../uniforms";
import {
  initializeGltfLoader,
  initializeDracoLoader,
  decompressDraco,
} from "../loaders";

// Type-safe interface for scene userData
type SceneUserData = {
  gltfAnimations?: AnimationClip[];
  [key: string]: unknown;
};

export async function renderModel(
  m: NavaraModelMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewEvents: EventHandler<ViewEvents>,
) {
  const loader = initializeGltfLoader();
  const dracoLoader = initializeDracoLoader();

  const rawScene = await (async () => {
    if (m.bin) {
      const bin = buf.removeU8(m.bin);
      if (!bin) {
        return;
      }

      if (m.material.__internal__?.point_cloud) {
        let geometry: BufferGeometry | undefined;
        const material = new PointsMaterial({
          size: m.material.point_size,
          vertexColors: true,
          sizeAttenuation: false,
        });

        if (m.material.__internal__?.draco_compressed) {
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
          if (m.material.show_bounding_box) {
            geometry.boundingBox = new Box3(
              new Vector3(
                m.aabb.center.x - m.aabb.extent.x,
                m.aabb.center.y - m.aabb.extent.y,
                m.aabb.center.z - m.aabb.extent.z,
              ),
              new Vector3(
                m.aabb.center.x + m.aabb.extent.x,
                m.aabb.center.y + m.aabb.extent.y,
                m.aabb.center.z + m.aabb.extent.z,
              ),
            );

            const boxHelper = new Box3Helper(geometry.boundingBox, 0xff0000);
            group.add(boxHelper);
          }
        }
        return group;
      }

      const model = await loader.parseAsync(bin.buffer as ArrayBuffer, "");
      if (m.material.show_bounding_box) {
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
      // Attach animations to the scene for downstream access
      const userData = model.scene.userData as SceneUserData;
      userData.gltfAnimations = model.animations;
      return model.scene;
    } else {
      if (!m.material.url) {
        return;
      }
      const model = await loader.loadAsync(m.material.url);
      // Attach animations to the scene for downstream access
      const userData = model.scene.userData as SceneUserData;
      userData.gltfAnimations = model.animations;
      if (m.material.show_bounding_box) {
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
      return model.scene;
    }
  })();

  if (!rawScene) {
    return;
  }

  const scene = new ModelMesh(rawScene, m, uniforms, buf, viewEvents);
  return scene;
}

export function processModelChanged(
  obj: ModelMesh,
  m: NavaraModelMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
