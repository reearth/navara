import { ImageLoader, TextureLoader } from "three";
import { DRACOLoader, GLTFLoader } from "three-stdlib";

import { DRACO_LOADER_CONCURRENCY } from "../concurrency";

export const TEXTURE_LOADER = new TextureLoader();
export const IMAGE_LOADER = new ImageLoader();

export const initializeGltfLoader = (() => {
  let GLTF: GLTFLoader;
  return () => {
    if (GLTF) return GLTF;
    GLTF = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setWorkerLimit(DRACO_LOADER_CONCURRENCY);
    draco.setDecoderPath(
      "https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/gltf/",
    );
    GLTF.setDRACOLoader(draco);
    return GLTF;
  };
})();
