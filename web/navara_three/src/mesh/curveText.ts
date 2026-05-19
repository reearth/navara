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
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Object3D,
  type PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

import type { PickableMesh } from "./pickableMesh";

const _tmpSize = new Vector2();

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

    if (batchId !== undefined) {
      this.setBatchId(batchId);
    }
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
      return;
    }

    const shape = this._fontManager.shapeTextCurves(this._fontIdentifier, text);
    const textures = this._fontManager.getCurveTextures(this._fontIdentifier);
    if (!shape || !textures) {
      this.geometry.instanceCount = 0;
      return;
    }

    this._buildGlyphInstances(shape);
    this._bindTextures(textures);
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
    if (material.depthTest !== undefined)
      this.material.depthTest = material.depthTest;
    if (material.center !== undefined) {
      u.uCenter.value.set(material.center.x, material.center.y);
    }

    const nextText = material.text;
    if (nextText !== undefined && nextText !== "") {
      this.setText(nextText, forceUpdate);
    }
    this.visible = material.show ?? this.visible;
  }

  // --- FeatureMesh interface (subset) ---

  _setFeatureColor(color: Color): void {
    this.setColor(color);
  }

  _getFeatureColor(): Color {
    return this._color;
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
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
      uFovRad: { value: 0 },
      uScreenHeightPx: { value: 1 },
      uFarPlane: { value: 1 },
      uCenter: { value: center },
      uAddHeight: { value: material.height ?? 0.0 },

      // Picking — written via setBatchId() / onBeforePicking(); set to 0/0
      // by default so non-picking passes render normally.
      nvr_uBatchId: { value: 0.0 },
      nvr_uPickable: { value: 0.0 },

      // Texture uniforms — bound to null until the first setText.
      uGlyphHeaders: { value: null },
      uBandData: { value: null },
      uBandCurves: { value: null },
      uCurveData: { value: null },
      uColorLayerHeaders: { value: null },
      uColorPaintParams: { value: null },
      uColorClipRecords: { value: null },
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

    const slots = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      slots[i] = shape.glyphs[i].headerSlot;
    }

    if (this.geometry.hasAttribute("aGlyphHeaderSlot")) {
      this.geometry.deleteAttribute("aGlyphHeaderSlot");
    }
    this.geometry.setAttribute(
      "aGlyphHeaderSlot",
      new InstancedBufferAttribute(slots, 1),
    );
    this.geometry.instanceCount = count;
  }

  private _bindTextures(textures: CurveTextureSet): void {
    const u = this.material.uniforms;
    u.uGlyphHeaders.value = textures.glyphHeaders;
    u.uBandData.value = textures.bandData;
    u.uBandCurves.value = textures.bandCurves;
    u.uCurveData.value = textures.curveData;
    u.uColorLayerHeaders.value = textures.colorLayerHeaders;
    u.uColorPaintParams.value = textures.colorPaintParams;
    u.uColorClipRecords.value = textures.colorClipRecords;
  }
}
