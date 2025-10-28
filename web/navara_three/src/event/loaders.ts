import { BufferGeometry, Cache, ImageLoader, TextureLoader } from "three";
import { DRACOLoader as DRACODecoder } from "three/addons/loaders/DRACOLoader.js";
import { DRACOLoader, GLTFLoader } from "three-stdlib";

import { FEATURE_CONCURRENCY } from "../concurrency";
import { AbortableImageLoader } from "../loaders";
import { AbortableTextureLoader } from "../loaders/AbortableTextureLoader";

Cache.enabled = true;

export const TEXTURE_LOADER = new TextureLoader();
export const ABORTABLE_TEXTURE_LOADER = new AbortableTextureLoader();
export const IMAGE_LOADER = new ImageLoader();
export const ABORTABLE_IMAGE_LOADER = new AbortableImageLoader();

export const initializeGltfLoader = (() => {
  let GLTF: GLTFLoader;
  return () => {
    if (GLTF) return GLTF;
    GLTF = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setWorkerLimit(FEATURE_CONCURRENCY);
    draco.setDecoderPath(
      "https://unpkg.com/three@0.170.0/examples/jsm/libs/draco/gltf/",
    );
    GLTF.setDRACOLoader(draco);
    return GLTF;
  };
})();

export const initializeDracoLoader = (() => {
  let draco: DRACODecoder;
  return () => {
    if (draco) return draco;
    draco = new DRACODecoder();
    draco.setWorkerLimit(FEATURE_CONCURRENCY);
    draco.setDecoderPath(
      "https://unpkg.com/three@0.180.0/examples/jsm/libs/draco/",
    );
    return draco;
  };
})();

export async function decompressDraco(
  buffer: ArrayBuffer,
  dracoLoader: DRACODecoder,
): Promise<BufferGeometry | undefined> {
  return new Promise((resolve) => {
    dracoLoader.parse(buffer, (geometry) => {
      resolve(geometry);
    });
  });
}
