import { BufferGeometry, Cache, ImageLoader, TextureLoader } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { DRACOLoader as DRACODecoder } from "three/addons/loaders/DRACOLoader.js";
import { DRACOLoader, GLTFLoader } from "three-stdlib";

import { AbortableImageLoader } from "../loaders";
import { AbortableTextureLoader } from "../loaders/AbortableTextureLoader";

Cache.enabled = true;

export const TEXTURE_LOADER = new TextureLoader();
export const ABORTABLE_TEXTURE_LOADER = new AbortableTextureLoader();
export const IMAGE_LOADER = new ImageLoader();
export const ABORTABLE_IMAGE_LOADER = new AbortableImageLoader();

const THREEJS_DRACO_MODULE_URL =
  "https://unpkg.com/three@0.184.0/examples/jsm/libs/draco/";

export const initializeGltfLoader = () => {
  // Instantiate these loaders every time to prevent worker occupation.
  const gltf = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setWorkerLimit(1);
  draco.setDecoderPath(THREEJS_DRACO_MODULE_URL);
  gltf.setDRACOLoader(draco);
  gltf.setMeshoptDecoder(MeshoptDecoder);
  return {
    loader: gltf,
    dispose: () => {
      gltf.dracoLoader?.dispose();
    },
  };
};

export const initializeDracoLoader = () => {
  // Instantiate these loaders every time to prevent worker occupation.
  const draco = new DRACODecoder();
  draco.setWorkerLimit(1);
  draco.setDecoderPath(THREEJS_DRACO_MODULE_URL);
  return {
    decoder: draco,
    dispose: () => {
      draco?.dispose();
    },
  };
};

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
