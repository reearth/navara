import type { EventHandler } from "@navara/core";
import { ModelMesh as NavaraModelMesh } from "@navara/engine";
import type { AnimationClip } from "three";
import { BufferGeometry, Points, Group, Float32BufferAttribute, PointsMaterial} from "three";
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
import { FEATURE_CONCURRENCY } from "../../concurrency";
import { ModelMesh } from "../../mesh/model";
import type { CommonUniforms } from "../../uniforms";
import { initializeGltfLoader } from "../loaders";

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
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://unpkg.com/three@0.180.0/examples/jsm/libs/draco/');
  dracoLoader.setWorkerLimit(FEATURE_CONCURRENCY);

  const rawScene = await (async () => {
    if (m.bin) {
      const bin = buf.removeU8(m.bin);
      if (!bin) {
        return;
      }

      if (m.material.point_cloud) {
        let geometry: BufferGeometry | undefined;
        const material = new PointsMaterial( { size: 0.3, vertexColors: true } );

        if (m.material.draco_point_compressed) {
          geometry = await decompressDraco(bin.buffer as ArrayBuffer, dracoLoader);
        } else {
          geometry = new BufferGeometry();
          geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(bin.buffer), 3));
        }

        const group = new Group();
        if (geometry) {
          const points: Points = new Points(geometry, material);
           group.add(points);
        }
        return group;
      }

      const model = await loader.parseAsync(bin.buffer as ArrayBuffer, "");
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
      return model.scene;
    }
  })();

  if (!rawScene) {
    return;
  }

  const scene = new ModelMesh(rawScene, m, uniforms, buf, viewEvents);
  dracoLoader.dispose();

  return scene;
}

export function processModelChanged(
  obj: ModelMesh,
  m: NavaraModelMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}


async function decompressDraco(buffer: ArrayBuffer, dracoLoader: DRACOLoader): Promise<BufferGeometry | undefined> {
  return new Promise((resolve) => {
    dracoLoader.parse(buffer, (geometry) => {
      const colors = geometry.getAttribute('color');
      if (colors) {
        // Normalize color values to [0, 1]
        const divisor = colors.array instanceof Uint8Array ? 255 : 65535;
        const colorArray = new Float32Array(colors.count * 3);
        for (let i = 0; i < colors.count; i++) {
          colorArray[i * 3] = colors.getX(i) / divisor;
          colorArray[i * 3 + 1] = colors.getY(i) / divisor;
          colorArray[i * 3 + 2] = colors.getZ(i) / divisor;
        }
        geometry.setAttribute('color', new Float32BufferAttribute(colorArray, 3));
      }
      resolve(geometry);
    });
  });
}