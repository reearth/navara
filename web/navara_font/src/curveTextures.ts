/**
 * GPU texture pool for the Slug-style curve pipeline.
 *
 * Wraps the four outline buffers (glyph headers, band data, band curves,
 * curve data) — and optionally the three color buffers — as Three.js
 * `DataTexture` instances. Each buffer is a 1D logical array packed into a
 * 2D texture; the fragment shader addresses each element by computing
 * `(idx % width, idx / width)`.
 *
 * One [CurveTextureSet] per atlas key. The [FontManager] owns these and
 * hands the same instance to every mesh that uses the matching font.
 *
 * Texture formats:
 *
 * | Buffer            | Stride per element | three.js format        | three.js type        |
 * | ----------------- | ------------------ | ---------------------- | -------------------- |
 * | glyphHeaders      | 12 f32 (3 texels)  | RGBAFormat             | FloatType            |
 * | bandData          | 1 u32              | RedIntegerFormat       | UnsignedIntType      |
 * | bandCurves        | 1 u32              | RedIntegerFormat       | UnsignedIntType      |
 * | curveData         | 6 f32 (3 texels)   | RGFormat               | FloatType            |
 * | colorLayerHeaders | 12 u32 (12 texels) | RedIntegerFormat       | UnsignedIntType      |
 * | colorPaintParams  | variable f32       | RedFormat              | FloatType            |
 * | colorClipRecords  | 8 u32 (8 texels)   | RedIntegerFormat       | UnsignedIntType      |
 *
 * The width is fixed per pool ([CURVE_TEX_WIDTH]); height is recomputed when
 * the underlying buffer grows. When the buffer's *length* changes the texture
 * is reallocated; otherwise an in-place `texSubImage2D` would suffice — but
 * three.js doesn't expose that on DataTexture, so we patch `image.data` and
 * mark `needsUpdate = true`. The dirty-range hint is kept for a future
 * direct-GL fast path.
 */

import {
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  RGFormat,
  RedFormat,
  RedIntegerFormat,
  UnsignedIntType,
} from "three";

import type {
  ColorCurveBufferSnapshot,
  CurveBufferSnapshot,
  CurveDirtyRange,
} from "./types";

/** Width (in texels) of every curve buffer texture. 1024 keeps the textures
 *  square-ish for typical font sizes — a 1024×1024 RGBA32F texture holds
 *  ~349k glyph headers, which is more than any realistic working set. */
export const CURVE_TEX_WIDTH = 1024;

/** Number of f32 per glyph header (must match HEADER_F32_COUNT in Rust). */
export const HEADER_F32_COUNT = 12;
/** Number of f32 per curve (must match CURVE_F32_COUNT in Rust). */
export const CURVE_F32_COUNT = 6;
/** Number of u32 per color layer header (must match LAYER_HEADER_U32S). */
export const COLOR_LAYER_HEADER_U32S = 12;
/** Number of u32 per clip record (must match CLIP_RECORD_U32S). */
export const COLOR_CLIP_RECORD_U32S = 8;

/** Per-buffer texture state, lazily created on first non-empty snapshot. */
type TextureSlot = {
  texture: DataTexture;
  /** Total length of the underlying buffer in *elements* (f32s or u32s). */
  length: number;
};

export class CurveTextureSet {
  // Outline buffers.
  private _headers: TextureSlot | null = null;
  private _bands: TextureSlot | null = null;
  private _bandCurves: TextureSlot | null = null;
  private _curves: TextureSlot | null = null;

  // Color buffers (optional).
  private _layerHeaders: TextureSlot | null = null;
  private _paintParams: TextureSlot | null = null;
  private _clipRecords: TextureSlot | null = null;

  get glyphHeaders(): DataTexture | null {
    return this._headers?.texture ?? null;
  }
  get bandData(): DataTexture | null {
    return this._bands?.texture ?? null;
  }
  get bandCurves(): DataTexture | null {
    return this._bandCurves?.texture ?? null;
  }
  get curveData(): DataTexture | null {
    return this._curves?.texture ?? null;
  }
  get colorLayerHeaders(): DataTexture | null {
    return this._layerHeaders?.texture ?? null;
  }
  get colorPaintParams(): DataTexture | null {
    return this._paintParams?.texture ?? null;
  }
  get colorClipRecords(): DataTexture | null {
    return this._clipRecords?.texture ?? null;
  }

  /**
   * Apply an outline snapshot from the worker. Allocates/grows textures as
   * needed and marks them dirty. Returns `true` if any texture changed.
   *
   * The dirty range is currently used only as a future optimization hint —
   * the three.js DataTexture path always uploads the whole image — but the
   * range is stored on each texture's `userData` so a custom WebGL fast path
   * could later sub-update without changes here.
   */
  applyOutline(snapshot: CurveBufferSnapshot): boolean {
    let changed = false;
    changed =
      this._upload(
        "headers",
        snapshot.glyphHeaders,
        HEADER_F32_COUNT,
        snapshot.dirty.headers,
      ) || changed;
    changed =
      this._upload("bands", snapshot.bandData, 1, snapshot.dirty.bandData) ||
      changed;
    changed =
      this._upload(
        "bandCurves",
        snapshot.bandCurves,
        1,
        snapshot.dirty.bandCurves,
      ) || changed;
    changed =
      this._upload(
        "curves",
        snapshot.curveData,
        CURVE_F32_COUNT,
        snapshot.dirty.curveData,
      ) || changed;
    return changed;
  }

  /** Apply a color (COLRv1) snapshot. Same semantics as [applyOutline]. */
  applyColor(snapshot: ColorCurveBufferSnapshot): boolean {
    let changed = false;
    changed =
      this._upload(
        "layerHeaders",
        snapshot.layerHeaders,
        COLOR_LAYER_HEADER_U32S,
        snapshot.dirty.layerHeaders,
      ) || changed;
    changed =
      this._upload(
        "paintParams",
        snapshot.paintParams,
        1,
        snapshot.dirty.paintParams,
      ) || changed;
    changed =
      this._upload(
        "clipRecords",
        snapshot.clipRecords,
        COLOR_CLIP_RECORD_U32S,
        snapshot.dirty.clipRecords,
      ) || changed;
    return changed;
  }

  dispose(): void {
    for (const slot of [
      this._headers,
      this._bands,
      this._bandCurves,
      this._curves,
      this._layerHeaders,
      this._paintParams,
      this._clipRecords,
    ]) {
      slot?.texture.dispose();
    }
    this._headers = null;
    this._bands = null;
    this._bandCurves = null;
    this._curves = null;
    this._layerHeaders = null;
    this._paintParams = null;
    this._clipRecords = null;
  }

  // -- Private --

  private _upload<T extends Float32Array | Uint32Array>(
    slot:
      | "headers"
      | "bands"
      | "bandCurves"
      | "curves"
      | "layerHeaders"
      | "paintParams"
      | "clipRecords",
    data: T,
    strideElementsPerLogicalUnit: number,
    dirty: CurveDirtyRange,
  ): boolean {
    // Phase 4: always reupload the full buffer when a snapshot arrives. The
    // [dirty] range is preserved as `userData.lastDirty` so a Phase 6
    // texSubImage2D fast path can use it without protocol changes.
    const length = data.length;
    const existing = this._slot(slot);

    if (!existing || existing.length !== length) {
      // First-time create or buffer was resized: allocate a new texture.
      existing?.texture.dispose();
      const tex = this._createTexture(slot, data, length);
      tex.userData.lastDirty = dirty;
      this._setSlot(slot, { texture: tex, length });
      return true;
    }

    // Same length → patch in place. The DataTexture was created with a
    // buffer padded up to `width * height * floatsPerTexel`; the new
    // snapshot is the raw unpadded buffer, so we must re-pad before
    // swapping `image.data` or WebGL will read past the ArrayBufferView.
    const { format } = describeSlot(slot);
    const floatsPerTexel =
      format === RGBAFormat ? 4 : format === RGFormat ? 2 : 1;
    const image = existing.texture.image as { width: number; height: number };
    const padded = padTo(data, image.width * image.height * floatsPerTexel);
    existing.texture.image.data = padded;
    existing.texture.needsUpdate = true;
    existing.texture.userData.lastDirty = dirty;
    this._setSlot(slot, existing);
    void strideElementsPerLogicalUnit; // reserved for sub-update path
    return true;
  }

  private _slot(
    name:
      | "headers"
      | "bands"
      | "bandCurves"
      | "curves"
      | "layerHeaders"
      | "paintParams"
      | "clipRecords",
  ): TextureSlot | null {
    switch (name) {
      case "headers":
        return this._headers;
      case "bands":
        return this._bands;
      case "bandCurves":
        return this._bandCurves;
      case "curves":
        return this._curves;
      case "layerHeaders":
        return this._layerHeaders;
      case "paintParams":
        return this._paintParams;
      case "clipRecords":
        return this._clipRecords;
    }
  }

  private _setSlot(
    name:
      | "headers"
      | "bands"
      | "bandCurves"
      | "curves"
      | "layerHeaders"
      | "paintParams"
      | "clipRecords",
    slot: TextureSlot,
  ): void {
    switch (name) {
      case "headers":
        this._headers = slot;
        return;
      case "bands":
        this._bands = slot;
        return;
      case "bandCurves":
        this._bandCurves = slot;
        return;
      case "curves":
        this._curves = slot;
        return;
      case "layerHeaders":
        this._layerHeaders = slot;
        return;
      case "paintParams":
        this._paintParams = slot;
        return;
      case "clipRecords":
        this._clipRecords = slot;
        return;
    }
  }

  private _createTexture(
    slot:
      | "headers"
      | "bands"
      | "bandCurves"
      | "curves"
      | "layerHeaders"
      | "paintParams"
      | "clipRecords",
    data: Float32Array | Uint32Array,
    length: number,
  ): DataTexture {
    // Choose format/type/stride based on which buffer this is.
    const { format, type, texelsPerRow } = describeSlot(slot);

    // Compute texture dimensions. We pack each element into `texelsPerRow`
    // texels; total texels = length / floatsPerTexel. To keep math simple
    // we use a fixed width of CURVE_TEX_WIDTH and compute height = ceil
    // (totalTexels / width), padding the buffer up to width*height texels.
    const floatsPerTexel =
      format === RGBAFormat ? 4 : format === RGFormat ? 2 : 1;
    const totalTexels = Math.ceil(length / floatsPerTexel);
    const width = CURVE_TEX_WIDTH;
    const height = Math.max(1, Math.ceil(totalTexels / width));

    // Pad the data up to width * height * floatsPerTexel if needed.
    const padded = padTo(data, width * height * floatsPerTexel);

    const tex = new DataTexture(padded, width, height, format, type);
    tex.minFilter = NearestFilter;
    tex.magFilter = NearestFilter;
    tex.generateMipmaps = false;
    tex.internalFormat = pickInternalFormat(format, type);
    tex.needsUpdate = true;
    tex.userData.bufferLength = length;
    tex.userData.texelsPerRow = texelsPerRow;
    return tex;
  }
}

function describeSlot(
  slot:
    | "headers"
    | "bands"
    | "bandCurves"
    | "curves"
    | "layerHeaders"
    | "paintParams"
    | "clipRecords",
): {
  format:
    | typeof RGBAFormat
    | typeof RGFormat
    | typeof RedFormat
    | typeof RedIntegerFormat;
  type: typeof FloatType | typeof UnsignedIntType;
  /** Number of *texels* one logical element occupies. */
  texelsPerRow: number;
} {
  switch (slot) {
    case "headers":
      // 12 f32 per glyph header → 3 RGBA32F texels.
      return { format: RGBAFormat, type: FloatType, texelsPerRow: 3 };
    case "bands":
      return {
        format: RedIntegerFormat,
        type: UnsignedIntType,
        texelsPerRow: 1,
      };
    case "bandCurves":
      return {
        format: RedIntegerFormat,
        type: UnsignedIntType,
        texelsPerRow: 1,
      };
    case "curves":
      // 6 f32 per curve → 3 RG32F texels.
      return { format: RGFormat, type: FloatType, texelsPerRow: 3 };
    case "layerHeaders":
      // 12 u32 per layer → 12 R32UI texels.
      return {
        format: RedIntegerFormat,
        type: UnsignedIntType,
        texelsPerRow: 12,
      };
    case "paintParams":
      return { format: RedFormat, type: FloatType, texelsPerRow: 1 };
    case "clipRecords":
      // 8 u32 per clip → 8 R32UI texels.
      return {
        format: RedIntegerFormat,
        type: UnsignedIntType,
        texelsPerRow: 8,
      };
  }
}

/** WebGL2 internal format chosen to match the three.js (format, type) pair.
 *  three.js auto-selects most of these, but for integer formats we set it
 *  explicitly so sampling works in GLSL with `usampler2D`. */
function pickInternalFormat(
  format: number,
  type: number,
): "RGBA32F" | "RG32F" | "R32F" | "R32UI" {
  if (type === UnsignedIntType) return "R32UI";
  if (format === RGBAFormat) return "RGBA32F";
  if (format === RGFormat) return "RG32F";
  return "R32F";
}

function padTo<T extends Float32Array | Uint32Array>(
  data: T,
  totalLength: number,
): T {
  if (data.length >= totalLength) return data;
  // Construct a new typed array of the same kind with the padded length.
  const Ctor = data.constructor as new (length: number) => T;
  const out = new Ctor(totalLength);
  out.set(data, 0);
  return out;
}
