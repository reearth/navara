import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RGBAFormat,
  Vector2,
} from "three";

import {
  LABEL_ROWS,
  LabelRow,
} from "../../material/enhancer/sdfText/sdfTextBaseEnhancer/types";

export { LABEL_ROWS, LabelRow };

/**
 * Texels per texture row. Fixed so a capacity grow never changes an existing
 * label's address — only the height grows, and previously written data stays
 * valid after the copy.
 */
const TEXTURE_WIDTH = 64;

/** Labels a freshly-created store is sized for, before row padding. */
const INITIAL_CAPACITY = 16;

/** Floats needed to hold `capacity` labels, padded out to whole texture rows. */
function floatsFor(capacity: number): number {
  const rows = Math.ceil((capacity * LABEL_ROWS) / TEXTURE_WIDTH);
  return rows * TEXTURE_WIDTH * 4;
}

/**
 * Labels an allocation can actually address — the row padding {@link floatsFor}
 * adds is usable space, not slack. Deriving capacity from the buffer instead of
 * from the requested count is what stops `ensureCapacity` from growing while
 * there are still free slots inside the current allocation.
 */
function labelsIn(floats: number): number {
  return Math.max(1, Math.floor(floats / 4 / LABEL_ROWS));
}

/**
 * Per-label state for a batched text mesh, stored in a float texture that the
 * vertex shader reads with `texelFetch`.
 *
 * A batched mesh's instances are *glyphs*, not labels, so anything that varies
 * per label can't be an instance attribute without replicating it onto every
 * glyph. Indirecting through this texture (via the `labelIndex` attribute)
 * keeps a per-label change — colour, size, the declutter fade running every
 * frame — at a handful of float writes regardless of how many glyphs the label
 * has, and leaves label state untouched when a text change relocates the
 * label's glyph run.
 *
 * Addressing mirrors `fogLight.frag.glsl`: a linear texel index split over a
 * fixed-width texture, sampled unfiltered. The row layout itself
 * ({@link LabelRow} / {@link LABEL_ROWS}) is the shader contract and lives with
 * the enhancer that owns the shader; `LABEL_ROWS` is injected there as a GLSL
 * define so the two addressing schemes can't drift.
 */
export class LabelDataTexture {
  private _capacity = 0;
  private _data: Float32Array;
  private _texture: DataTexture;
  private readonly _size = new Vector2();

  constructor(initialCapacity = INITIAL_CAPACITY) {
    this._data = new Float32Array(floatsFor(Math.max(1, initialCapacity)));
    this._capacity = labelsIn(this._data.length);
    this._texture = this._createTexture();
  }

  /** The texture to bind to `uLabelData`. Replaced by {@link ensureCapacity}. */
  get texture(): DataTexture {
    return this._texture;
  }

  /** Dimensions in texels, for the `uLabelTexSize` uniform. */
  get size(): Vector2 {
    return this._size;
  }

  /**
   * Labels addressable without a grow. Derived from the allocation, so it
   * includes the row padding and is generally larger than the count the store
   * was constructed or grown for.
   */
  get capacity(): number {
    return this._capacity;
  }

  /**
   * Make room for `slotCount` labels.
   *
   * Returns `true` when the backing `DataTexture` was replaced, in which case
   * the caller must re-point the `uLabelData` uniform and refresh
   * `uLabelTexSize`. Existing label data survives unchanged.
   */
  ensureCapacity(slotCount: number): boolean {
    if (slotCount <= this._capacity) return false;

    let target = this._capacity;
    while (target < slotCount) target *= 2;

    const data = new Float32Array(floatsFor(target));
    data.set(this._data);

    this._data = data;
    this._capacity = labelsIn(data.length);
    this._texture.dispose();
    this._texture = this._createTexture();
    return true;
  }

  /** Write a whole texel. */
  setRow(
    slot: number,
    row: number,
    x: number,
    y: number,
    z: number,
    w: number,
  ): void {
    const i = (slot * LABEL_ROWS + row) * 4;
    const data = this._data;
    data[i] = x;
    data[i + 1] = y;
    data[i + 2] = z;
    data[i + 3] = w;
    this._texture.needsUpdate = true;
  }

  /** Write one channel of a texel, leaving the other three alone. */
  setComponent(
    slot: number,
    row: number,
    component: number,
    value: number,
  ): void {
    this._data[(slot * LABEL_ROWS + row) * 4 + component] = value;
    this._texture.needsUpdate = true;
  }

  /** Read one channel back — used by the declutter fade's read/modify/write. */
  getComponent(slot: number, row: number, component: number): number {
    return this._data[(slot * LABEL_ROWS + row) * 4 + component];
  }

  /** Zero a label's rows so a recycled slot can't inherit stale state. */
  clearSlot(slot: number): void {
    const start = slot * LABEL_ROWS * 4;
    this._data.fill(0, start, start + LABEL_ROWS * 4);
    this._texture.needsUpdate = true;
  }

  /** Mark the texture for re-upload without writing anything. */
  markDirty(): void {
    this._texture.needsUpdate = true;
  }

  dispose(): void {
    this._texture.dispose();
  }

  private _createTexture(): DataTexture {
    // Derived from the buffer rather than recomputed from `_capacity`: the
    // texture must describe exactly the memory it is backed by.
    const height = this._data.length / (TEXTURE_WIDTH * 4);
    const tex = new DataTexture(
      this._data,
      TEXTURE_WIDTH,
      height,
      RGBAFormat,
      FloatType,
    );
    // texelFetch is unfiltered by definition, but the sampler state still has
    // to be complete for the texture to be bindable.
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this._size.set(TEXTURE_WIDTH, height);
    return tex;
  }
}
