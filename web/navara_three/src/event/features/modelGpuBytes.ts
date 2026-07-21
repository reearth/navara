import {
  BufferGeometry,
  type Material,
  type Mesh,
  type Object3D,
  type Points,
  type Texture,
} from "three";

/** After the first GPU upload the model's geometry attributes drop their
 * CPU-side typed arrays via `onUpload` (see mesh/model.ts →
 * releaseGeometryArraysAfterUpload), so only the GPU copy stays resident and
 * each geometry byte is counted once. Mirrors the Rust
 * `GPU_GEOMETRY_RESIDENCY_FACTOR` used for terrain/vector geometry. */
const GPU_GEOMETRY_RESIDENCY_FACTOR = 1;

/** Approximate GPU bytes of a texture: `image.data.byteLength` when present
 * (raw DataTexture), else `width*height*4` (RGBA). Ignores mipmaps.
 *
 * Not scaled by the residency factor: `ImageBitmap`-backed textures (the glTF
 * loader default) hand their pixels to the GPU and keep no CPU copy, so unlike
 * geometry they are resident only once. `DataTexture`s do keep a CPU copy, but
 * models rarely use them, so we accept the small undercount for simplicity. */
function textureGpuBytes(tex: Texture): number {
  const img = tex.image as
    | { data?: { byteLength?: number }; width?: number; height?: number }
    | undefined;
  if (img?.data?.byteLength) return img.data.byteLength;
  if (img?.width && img?.height) return img.width * img.height * 4;
  return 0;
}

/**
 * Sum the decoded GPU bytes of a rendered model: every geometry's vertex
 * attributes + index, plus each unique material texture. This is measured
 * AFTER glTF/Draco decode (which inflates geometry well beyond the compressed
 * payload), so it is the accurate figure to report to the memory ledger.
 *
 * Kept dependency-free (only `three`) so it can be unit-tested without pulling
 * in the GLTF/Draco loader module chain.
 */
export function sumModelGpuBytes(obj: Object3D): number {
  let geometryBytes = 0;
  let textureBytes = 0;
  const seenGeometries = new Set<BufferGeometry>();
  const seenTextures = new Set<Texture>();
  obj.traverse((node) => {
    const geometry = (node as Mesh | Points).geometry;
    // Dedupe geometries too, not just textures: glTF instancing reuses one
    // BufferGeometry across many nodes, and its GPU buffers are uploaded once,
    // so counting it per-node would over-report and trip eviction early.
    if (geometry instanceof BufferGeometry && !seenGeometries.has(geometry)) {
      seenGeometries.add(geometry);
      for (const attr of Object.values(geometry.attributes)) {
        const array = (attr as { array?: { byteLength?: number } }).array;
        if (array?.byteLength) geometryBytes += array.byteLength;
      }
      if (geometry.index?.array?.byteLength) {
        geometryBytes += geometry.index.array.byteLength;
      }
    }
    const material = (node as Mesh | Points).material as
      Material | Material[] | undefined;
    const materials = Array.isArray(material)
      ? material
      : material
        ? [material]
        : [];
    for (const mat of materials) {
      for (const value of Object.values(mat)) {
        if (
          value &&
          typeof value === "object" &&
          "isTexture" in value &&
          (value as Texture).isTexture &&
          !seenTextures.has(value as Texture)
        ) {
          seenTextures.add(value as Texture);
          textureBytes += textureGpuBytes(value as Texture);
        }
      }
    }
  });
  return geometryBytes * GPU_GEOMETRY_RESIDENCY_FACTOR + textureBytes;
}
