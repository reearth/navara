import type { Material, Object3D, Texture } from "three";

// Adjust the texture's aspect ratio automatically.
export function applyTextureAspect(obj: Object3D) {
  const material = "material" in obj ? (obj.material as Material) : undefined;
  if (
    material &&
    !Array.isArray(material) &&
    "map" in material &&
    material.map
  ) {
    const map = material.map as Texture<ImageData>;
    if (map) {
      const image = map.image;
      const aspectRatio = image.height / image.width;
      obj.scale.y *= aspectRatio;
    }
  }
}
