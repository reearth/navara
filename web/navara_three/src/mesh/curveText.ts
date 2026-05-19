import type {
  TextMaterial as NavaraTextMaterial,
  Transform,
} from "@navara/engine";
import { type CurveTextureSet, type FontManager } from "@navara/font";
import { CURVE_TEX_WIDTH } from "@navara/font";
import { degreeToRadian } from "@navara/three_api";
import curveTextFragmentShader from "@shaders/glsl/curveText.frag.glsl";
import curveTextVertexShader from "@shaders/glsl/curveText.vert.glsl";
import {
  BufferAttribute,
  Color,
  DataTexture,
  FloatType,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NearestFilter,
  Object3D,
  type PerspectiveCamera,
  RedFormat,
  RedIntegerFormat,
  RGBAFormat,
  RGFormat,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
} from "three";

import type { PickableMesh } from "./pickableMesh";

const _tmpSize = new Vector2();

/** Lazily-created 1×1 placeholder textures for the curve shader's sampler
 *  uniforms. three.js binds its default RGBA8 empty texture to any null
 *  sampler — that mismatches our `usampler2D` (integer) samplers and trips
 *  WebGL with "Mismatch between texture format and sampler type" the first
 *  time the program runs. Pre-binding format-correct 1×1 textures keeps the
 *  pipeline valid even if a draw call sneaks in before `_bindTextures`. */
let _placeholderFloatRGBA: DataTexture | null = null;
let _placeholderFloatRG: DataTexture | null = null;
let _placeholderFloatR: DataTexture | null = null;
let _placeholderUintR: DataTexture | null = null;

function _makePlaceholder(
  format:
    | typeof RGBAFormat
    | typeof RGFormat
    | typeof RedFormat
    | typeof RedIntegerFormat,
  type: typeof FloatType | typeof UnsignedIntType,
  internalFormat: "RGBA32F" | "RG32F" | "R32F" | "R32UI",
): DataTexture {
  const channels = format === RGBAFormat ? 4 : format === RGFormat ? 2 : 1;
  const data =
    type === UnsignedIntType
      ? new Uint32Array(channels)
      : new Float32Array(channels);
  const tex = new DataTexture(data, 1, 1, format, type);
  tex.internalFormat = internalFormat;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function placeholderFloatRGBA(): DataTexture {
  return (_placeholderFloatRGBA ??= _makePlaceholder(
    RGBAFormat,
    FloatType,
    "RGBA32F",
  ));
}
function placeholderFloatRG(): DataTexture {
  return (_placeholderFloatRG ??= _makePlaceholder(
    RGFormat,
    FloatType,
    "RG32F",
  ));
}
function placeholderFloatR(): DataTexture {
  return (_placeholderFloatR ??= _makePlaceholder(
    RedFormat,
    FloatType,
    "R32F",
  ));
}
function placeholderUintR(): DataTexture {
  return (_placeholderUintR ??= _makePlaceholder(
    RedIntegerFormat,
    UnsignedIntType,
    "R32UI",
  ));
}

/**
 * Slug-style GPU-direct curve text mesh.
 *
 * Phase 4: minimal scaffold. Mirrors [SDFTextMesh] in structure (instanced
 * quad geometry, shared shader material, per-frame uniform updates), but
 * the per-instance attribute is just a `aGlyphHeaderSlot` — the vertex
 * shader fetches the glyph's bbox from the shared header texture, and the
 * fragment shader (Phase 5) will fetch curves from the band/curve textures.
 *
 * The mesh is opt-in: callers must call `FontManager.prepareTextCurves(...)`
 * before constructing one, then `setText(...)` reads the cached curve shape
 * result and the shared [CurveTextureSet].
 */
export class CurveTextMesh
  extends Mesh<InstancedBufferGeometry, ShaderMaterial>
  implements PickableMesh
{
  private _fontManager: FontManager;
  private _fontIdentifier: string;
  private _text = "";
  private _useRTE: boolean;
  private _color: Color;
  // Curve textures (the `usampler2D` uniforms in particular) start as null;
  // if the mesh is rendered before `_bindTextures` runs, three.js binds its
  // default RGBA8 empty texture to the integer samplers, which trips
  // "Mismatch between texture format and sampler type" on draw. We track
  // intended visibility separately and only flip `this.visible` true once
  // textures land.
  private _intendedVisible = true;
  private _texturesBound = false;

  constructor(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    material: NavaraTextMaterial,
    transform: Transform,
    fontManager: FontManager,
    fontIdentifier: string,
    batchId: number | undefined,
    RTE: boolean,
  ) {
    super();

    this._fontManager = fontManager;
    this._fontIdentifier = fontIdentifier;
    this._useRTE = RTE;
    this._color = new Color(material.color ?? 0xffffff);

    this.geometry = this._createBaseGeometry();

    const mat = new ShaderMaterial({
      vertexShader: curveTextVertexShader,
      fragmentShader: curveTextFragmentShader,
      defines: RTE ? { USE_RTE: 1 } : {},
      uniforms: this._initialUniforms(material, transform, position),
      transparent: true,
      depthTest: material.depthTest ?? true,
      // Integer texture sampling (`usampler2D`) needs GLSL ES 3.0.
      glslVersion: GLSL3,
    });

    mat.onBeforeRender = (renderer, _scene, camera) => {
      const pCam = camera as PerspectiveCamera;
      const screenHeightPx =
        renderer.getDrawingBufferSize(_tmpSize).y / renderer.getPixelRatio();
      mat.uniforms.uFovRad.value = degreeToRadian(pCam.fov);
      mat.uniforms.uScreenHeightPx.value = screenHeightPx;
      mat.uniforms.uFarPlane.value = pCam.far;
      mat.uniforms.uEyeRTEHigh.value.copy(camera.position);
      mat.uniforms.uEyeRTELow.value.set(0, 0, 0);
    };

    this.material = mat;
    this.frustumCulled = false;
    this.visible = false;

    if (batchId !== undefined) {
      this.setBatchId(batchId);
    }
  }

  private _syncVisibility(): void {
    this.visible = this._intendedVisible && this._texturesBound;
  }

  /**
   * Set text to render. Reads the cached curve shape from FontManager and
   * builds per-instance attributes. The font must have been prepared first
   * via `FontManager.prepareTextCurves(...)`.
   */
  setText(text: string, forceUpdate = false): void {
    if (text === this._text && !forceUpdate) return;
    this._text = text;

    if (!text) {
      this.geometry.instanceCount = 0;
      this._texturesBound = false;
      this._syncVisibility();
      return;
    }

    const shape = this._fontManager.shapeTextCurves(this._fontIdentifier, text);
    const textures = this._fontManager.getCurveTextures(this._fontIdentifier);
    if (!shape || !textures) {
      this.geometry.instanceCount = 0;
      this._texturesBound = false;
      this._syncVisibility();
      return;
    }

    this._buildGlyphInstances(shape);
    this._bindTextures(textures);
    this._texturesBound = true;
    this._syncVisibility();
  }

  setColor(color: Color | number): void {
    this._color.set(color);
    this.material.uniforms.uColor.value.copy(this._color);
  }

  setHeight(height: number): void {
    this.material.uniforms.uAddHeight.value = height;
  }

  setBatchId(batchId: number): void {
    this.material.uniforms.nvr_uBatchId.value = batchId;
  }

  setPosition(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    transform: Transform,
  ): void {
    this._useRTE = RTE;
    const u = this.material.uniforms;
    if (RTE) {
      const p = position as { high: Float32Array; low: Float32Array };
      u.uRTEPositionHIGH.value.fromArray(p.high);
      u.uRTEPositionLOW.value.fromArray(p.low);
    } else {
      const p = position as Float32Array;
      u.uRTCPosition.value.fromArray(p);
    }
    u.uRTCCenter.value.set(transform.tx, transform.ty, transform.tz);
  }

  /** Apply a TextMaterial: color, size, height, and text. Mirrors the SDF
   *  mesh's `update` but only the subset of properties the Phase 5 fragment
   *  shader actually consumes. Stroke / background / outline land in a
   *  follow-up. */
  update(material: NavaraTextMaterial, forceUpdate = false): void {
    const u = this.material.uniforms;
    if (material.color !== undefined) {
      this._color.set(material.color);
      u.uColor.value.copy(this._color);
    }
    if (material.size !== undefined) u.uFontSize.value = material.size;
    if (material.sizeInMeters !== undefined)
      u.uSizeInMeters.value = material.sizeInMeters;
    if (material.height !== undefined) u.uAddHeight.value = material.height;
    if (material.offsetDepth !== undefined)
      u.uOffsetDepth.value = material.offsetDepth;
    if (material.depthTest !== undefined)
      this.material.depthTest = material.depthTest;
    if (material.center !== undefined) {
      u.uCenter.value.set(material.center.x, material.center.y);
    }

    const nextText = material.text;
    if (nextText !== undefined && nextText !== "") {
      this.setText(nextText, forceUpdate);
    }
    if (material.show !== undefined) {
      this._intendedVisible = material.show;
      this._syncVisibility();
    }
  }

  // --- FeatureMesh interface (subset) ---

  _setFeatureColor(color: Color): void {
    this.setColor(color);
  }

  _getFeatureColor(): Color {
    return this._color;
  }

  _setFeatureShow(visible: boolean): void {
    this._intendedVisible = visible;
    this._syncVisibility();
  }

  _setFeatureHeight(height: number): void {
    this.setHeight(height);
  }

  _setFrustumCulled(culled: boolean): void {
    this.frustumCulled = culled;
  }

  // --- PickableMesh interface ---

  onBeforePicking(): void {
    this.material.uniforms.nvr_uPickable.value = 1.0;
  }

  onAfterPicking(): void {
    this.material.uniforms.nvr_uPickable.value = 0.0;
  }

  getRenderable(): Object3D {
    return this;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  // --- Private ---

  private _createBaseGeometry(): InstancedBufferGeometry {
    const geo = new InstancedBufferGeometry();

    // Unit quad: 2 triangles, 6 vertices, position only (UV is computed from
    // the bbox in the vertex shader; we don't need an interpolated UV).
    // prettier-ignore
    const positions = new Float32Array([
      -0.5, -0.5, 0,   0.5, -0.5, 0,   0.5, 0.5, 0,
      -0.5, -0.5, 0,   0.5,  0.5, 0,  -0.5, 0.5, 0,
    ]);
    geo.setAttribute("position", new BufferAttribute(positions, 3));

    geo.setAttribute(
      "aGlyphHeaderSlot",
      new InstancedBufferAttribute(new Float32Array(), 1),
    );
    // Em-space cursor position for this glyph (accumulated xAdvance + xOffset
    // from shaping, divided by units_per_em). The vertex shader adds this on
    // top of the glyph bbox so successive glyphs lay out left-to-right.
    geo.setAttribute(
      "aGlyphCursor",
      new InstancedBufferAttribute(new Float32Array(), 2),
    );

    geo.instanceCount = 0;
    return geo;
  }

  private _initialUniforms(
    material: NavaraTextMaterial,
    transform: Transform,
    position: Float32Array | { high: Float32Array; low: Float32Array },
  ): Record<string, { value: unknown }> {
    const center = material.center
      ? new Vector2(material.center.x, material.center.y)
      : new Vector2(0, 0);
    return {
      uColor: { value: new Color(material.color ?? 0xffffff) },
      uOpacity: { value: 1.0 },
      uFontSize: { value: material.size ?? 16.0 },
      uSizeInMeters: { value: material.sizeInMeters ?? true },
      // Mirror the SDF mesh's default: pulls labels slightly toward camera so
      // they don't z-fight with the surface they anchor to (terrain, roof).
      uOffsetDepth: { value: material.offsetDepth ?? true },
      uFovRad: { value: 0 },
      uScreenHeightPx: { value: 1 },
      uFarPlane: { value: 1 },
      uCenter: { value: center },
      uAddHeight: { value: material.height ?? 0.0 },
      // Text-run dimensions in em-space, used by the vertex shader to
      // resolve the `uCenter` anchor against the whole label rather than
      // each glyph.
      uTextWidthEm: { value: 0.0 },
      uTextHeightEm: { value: 1.0 },

      // Picking — written via setBatchId() / onBeforePicking(); set to 0/0
      // by default so non-picking passes render normally.
      nvr_uBatchId: { value: 0.0 },
      nvr_uPickable: { value: 0.0 },

      // Texture uniforms — pre-bound to 1×1 placeholders that match each
      // sampler's GLSL type. `_bindTextures` swaps in the real shared
      // textures once the worker has populated them.
      uGlyphHeaders: { value: placeholderFloatRGBA() },
      uBandData: { value: placeholderUintR() },
      uBandCurves: { value: placeholderUintR() },
      uCurveData: { value: placeholderFloatRG() },
      uColorLayerHeaders: { value: placeholderUintR() },
      uColorPaintParams: { value: placeholderFloatR() },
      uColorClipRecords: { value: placeholderUintR() },
      uCurveTexWidth: { value: CURVE_TEX_WIDTH },

      // Position / eye uniforms. The vertex shader picks between RTE/RTC by
      // the USE_RTE define; only one set is read per draw.
      uRTEPositionHIGH: {
        value: this._useRTE
          ? new Vector3().fromArray(
              (position as { high: Float32Array }).high ?? [0, 0, 0],
            )
          : new Vector3(),
      },
      uRTEPositionLOW: {
        value: this._useRTE
          ? new Vector3().fromArray(
              (position as { low: Float32Array }).low ?? [0, 0, 0],
            )
          : new Vector3(),
      },
      uEyeRTEHigh: { value: new Vector3() },
      uEyeRTELow: { value: new Vector3() },
      uRTCPosition: {
        value: this._useRTE
          ? new Vector3()
          : new Vector3().fromArray(position as Float32Array),
      },
      uRTCCenter: {
        value: new Vector3(transform.tx, transform.ty, transform.tz),
      },
    };
  }

  private _buildGlyphInstances(
    shape: ReturnType<FontManager["shapeTextCurves"]>,
  ): void {
    if (!shape) {
      this.geometry.instanceCount = 0;
      return;
    }
    const count = shape.glyphs.length;
    if (count === 0) {
      this.geometry.instanceCount = 0;
      return;
    }
    const upem = shape.unitsPerEm;
    if (upem <= 0) {
      this.geometry.instanceCount = 0;
      return;
    }
    const invUpem = 1.0 / upem;

    const slots = new Float32Array(count);
    const cursors = new Float32Array(count * 2);

    // Walk the shaped run, accumulating xAdvance/yAdvance in font-units and
    // emitting each glyph's origin in em-space (= cursor + xOffset/upem).
    let cursorFuX = 0;
    let cursorFuY = 0;
    for (let i = 0; i < count; i++) {
      const g = shape.glyphs[i];
      slots[i] = g.headerSlot;
      cursors[i * 2] = (cursorFuX + g.xOffset) * invUpem;
      cursors[i * 2 + 1] = (cursorFuY + g.yOffset) * invUpem;
      cursorFuX += g.xAdvance;
      cursorFuY += g.yAdvance;
    }
    const textWidthEm = cursorFuX * invUpem;

    if (this.geometry.hasAttribute("aGlyphHeaderSlot")) {
      this.geometry.deleteAttribute("aGlyphHeaderSlot");
    }
    this.geometry.setAttribute(
      "aGlyphHeaderSlot",
      new InstancedBufferAttribute(slots, 1),
    );
    if (this.geometry.hasAttribute("aGlyphCursor")) {
      this.geometry.deleteAttribute("aGlyphCursor");
    }
    this.geometry.setAttribute(
      "aGlyphCursor",
      new InstancedBufferAttribute(cursors, 2),
    );
    this.geometry.instanceCount = count;

    // Text-run dimensions for the anchor calculation (em-space).
    this.material.uniforms.uTextWidthEm.value = textWidthEm;
    this.material.uniforms.uTextHeightEm.value = 1.0;
  }

  private _bindTextures(textures: CurveTextureSet): void {
    // Monochrome fonts never populate the COLR buffers — keep the
    // format-matched placeholder textures in those slots instead of
    // overwriting with `null`, otherwise three.js falls back to its RGBA8
    // empty texture and the `usampler2D` bindings mismatch on draw.
    const u = this.material.uniforms;
    u.uGlyphHeaders.value = textures.glyphHeaders ?? placeholderFloatRGBA();
    u.uBandData.value = textures.bandData ?? placeholderUintR();
    u.uBandCurves.value = textures.bandCurves ?? placeholderUintR();
    u.uCurveData.value = textures.curveData ?? placeholderFloatRG();
    u.uColorLayerHeaders.value =
      textures.colorLayerHeaders ?? placeholderUintR();
    u.uColorPaintParams.value =
      textures.colorPaintParams ?? placeholderFloatR();
    u.uColorClipRecords.value = textures.colorClipRecords ?? placeholderUintR();
  }
}
