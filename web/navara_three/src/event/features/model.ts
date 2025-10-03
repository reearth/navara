import type { EventHandler } from "@navara/core";
import { ModelMesh as NavaraModelMesh } from "@navara/engine";
import type { AnimationClip } from "three";

import type { BufferLoader } from "../";
import type { ViewEvents } from "../..";
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

  const rawScene = await (async () => {
    if (m.bin) {
      const bin = buf.removeU8(m.bin);
      if (!bin) {
        return;
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

  return scene;
}

export function processModelChanged(
  obj: ModelMesh,
  m: NavaraModelMesh,
  active: boolean,
) {
  obj._update(m.material, active);
}
