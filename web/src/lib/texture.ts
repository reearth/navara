import type { Material, Object3D, Texture } from "three";

// Ajust the texture's aspect ratio automatically.
export function applyTextureAspect(obj: Object3D) {
  const material = "material" in obj ? (obj.material as Material) : undefined;
  if (material && !Array.isArray(material) && "map" in material && material.map) {
    const map = material.map as Texture;
    if (material.map) {
      const aspectRatio = map.image.height / map.image.width;
      obj.scale.y *= aspectRatio;
    }
  }
}
