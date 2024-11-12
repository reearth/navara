import { ImageLoader, TextureLoader } from "three";
import { DRACOLoader, GLTFLoader } from "three-stdlib";

export const TEXTURE_LOADER = new TextureLoader();
export const IMAGE_LOADER = new ImageLoader();

export const initializeGltfLoader = (() => {
  let GLTF: GLTFLoader;
  return () => {
    if (GLTF) return GLTF;
    GLTF = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(
      "https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/gltf/",
    );
    GLTF.setDRACOLoader(draco);
    return GLTF;
  };
})();
