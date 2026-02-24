import { Unimplemented } from "@navara/core";
import type { TextMaterial as NavaraTextMaterial, Transform } from "@navara/engine";
import sdfTextVertexShader from "@shaders/glsl/sdfText.vert.glsl";
import sdfTextFragmentShader from "@shaders/glsl/sdfText.frag.glsl";
import {
  BufferAttribute,
  Color,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";

import type {
  FontManager,
  GlyphMetrics,
  ShapeTextResult,
} from "../font/FontManager";
import type { CommonUniforms } from "../uniforms";

import { setRTCPosition } from "./rtcRteHelper";

/** Must match Rust SDF_PX_SIZE in navara_font/src/resource.rs */
const SDF_PX_SIZE = 64.0;

/**
 * A text mesh that renders glyphs from an SDF atlas using instanced geometry.
 *
 * Each glyph is an instanced unit quad positioned by shaping data,
 * sampling from a per-font SDF atlas texture. Uses billboard rendering
 * so text always faces the camera.
 */
export class SdfTextMesh extends Mesh<
  InstancedBufferGeometry,
  ShaderMaterial
> {
  private _fontManager: FontManager;
  private _fontUrl: string;
  private _text = "";
  private _atlasTexture: DataTexture | null = null;

  constructor(
    fontManager: FontManager,
    fontUrl: string,
    uniforms: CommonUniforms,
    batchId: number,
  ) {
    super();

    this._fontManager = fontManager;
    this._fontUrl = fontUrl;

    this.userData.rtcPos = { value: new Vector3() };

    this.geometry = this._createBaseGeometry();
    this.material = this._createMaterial(uniforms, batchId);
    this.frustumCulled = false;
  }

  /**
   * Set text to render. Shapes via WASM, rebuilds instanced geometry, updates atlas texture.
   */
  setText(text: string): void {
    if (text === this._text) return;
    this._text = text;

    if (!text) {
      this.geometry.instanceCount = 0;
      this.visible = false;
      return;
    }

    const shapeResult = this._fontManager.shapeText(this._fontUrl, text);
    if (!shapeResult) {
      this.geometry.instanceCount = 0;
      return;
    }

    const atlasData = this._fontManager.getAtlas(this._fontUrl);
    if (!atlasData) return;

    this._buildGlyphInstances(shapeResult, atlasData.width, atlasData.height);
    this._updateAtlasTexture(atlasData.data, atlasData.width, atlasData.height);
    this.visible = true;
  }

  /**
   * Set position using RTC encoding.
   */
  setPosition(
    position: Float32Array<ArrayBufferLike> | null | undefined,
    posIdx: number,
    transform: Transform,
  ): void {
    setRTCPosition(this, position, posIdx, transform);
    this.material.uniforms.rtcPos.value.copy(this.userData.rtcPos.value);
  }

  /**
   * Update visual properties: color, size, visibility, etc.
   */
  setColor(color: Color): void {
    this.material.uniforms.uColor.value.copy(color);
  }

  setFontSize(sizePx: number): void {
    this.material.uniforms.uFontSizePx.value = sizePx;
  }

  setOpacity(opacity: number): void {
    this.material.uniforms.uOpacity.value = opacity;
  }

  setScaleByDistance(enabled: boolean): void {
    this.material.uniforms.uScaleByDistance.value = enabled ? 1.0 : 0.0;
  }

  setCenter(x: number, y: number): void {
    this.material.uniforms.uCenter.value.set(x, y);
  }

  setHeight(height: number): void {
    this.material.uniforms.uAddHeight.value = height;
  }

  /**
   * Apply material properties from WASM TextMaterial.
   * Maps relevant properties to SdfTextMesh setters, with change tracking.
   */
  updateFromMaterial(material: NavaraTextMaterial, active: boolean): void {
    if (!this.userData.prev) {
      this.userData.prev = {};
    }
    const prev = this.userData.prev;

    const nextText = material.text;
    if (nextText !== prev.text) {
      prev.text = nextText;
      this.setText(nextText ?? "");
    }

    const nextVisible = true;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }

    const nextColor = material.color ?? 0xffffff;
    if (nextColor !== prev.color) {
      prev.color = nextColor;
      this.material.uniforms.uColor.value.set(nextColor);
    }

    if (!nextVisible) return;

    const nextFontSize = material.size ?? 16.0;
    if (nextFontSize !== prev.fontSize) {
      prev.fontSize = nextFontSize;
      this.setFontSize(nextFontSize);
    }

    const nextCenterX = material.center?.x ?? 0.5;
    const nextCenterY = material.center?.y ?? 0;
    if (nextCenterX !== prev.centerX || nextCenterY !== prev.centerY) {
      prev.centerX = nextCenterX;
      prev.centerY = nextCenterY;
      this.setCenter(nextCenterX, nextCenterY);
    }

    const nextScaleByDistance = material.scaleByDistance ?? false;
    if (nextScaleByDistance !== prev.scaleByDistance) {
      prev.scaleByDistance = nextScaleByDistance;
      this.setScaleByDistance(nextScaleByDistance);
    }

    const nextDepthTest = material.depthTest ?? true;
    if (nextDepthTest !== prev.depthTest) {
      prev.depthTest = nextDepthTest;
      this.material.depthTest = nextDepthTest;
    }

    const nextOffsetDepth = material.offsetDepth ?? true;
    if (nextOffsetDepth !== prev.offsetDepth) {
      prev.offsetDepth = nextOffsetDepth;
      this.material.uniforms.uOffsetDepth.value = nextOffsetDepth;
    }

    const nextHeight = material.height ?? 0;
    if (nextHeight !== prev.height) {
      prev.height = nextHeight;
      this.setHeight(nextHeight);
    }
  }

  // --- FeatureMesh interface ---

  _setFeatureColor(color: Color): void {
    this.setColor(color);
  }

  _getFeatureColor(): Color {
    return this.material.uniforms.uColor.value.clone();
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  _setFeatureHeight(height: number): void {
    this.setHeight(height);
  }

  _setFrustumCulled(culled: boolean): void {
    this.frustumCulled = culled;
  }

  // --- PickableMesh interface ---

  _setPickable(pickable: boolean): void {
    this.material.uniforms.nvr_uPickable.value = pickable ? 1.0 : 0.0;
    this.frustumCulled = !pickable;
  }

  // --- Cleanup ---

  dispose(): void {
    this.geometry?.dispose();
    this._atlasTexture?.dispose();
    this.material?.dispose();
  }

  // --- Private ---

  private _createBaseGeometry(): InstancedBufferGeometry {
    const geo = new InstancedBufferGeometry();

    // Unit quad: 2 triangles, 6 vertices
    // prettier-ignore
    const positions = new Float32Array([
      -0.5, -0.5, 0,   0.5, -0.5, 0,   0.5, 0.5, 0,
      -0.5, -0.5, 0,   0.5,  0.5, 0,  -0.5, 0.5, 0,
    ]);
    // prettier-ignore
    const uvs = new Float32Array([
      0, 0,  1, 0,  1, 1,
      0, 0,  1, 1,  0, 1,
    ]);

    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("uv", new BufferAttribute(uvs, 2));
    geo.instanceCount = 0;

    return geo;
  }

  private _createMaterial(
    uniforms: CommonUniforms,
    batchId: number,
  ): ShaderMaterial {
    const material = new ShaderMaterial({
      vertexShader: sdfTextVertexShader,
      fragmentShader: sdfTextFragmentShader,
      uniforms: {
        uAtlas: { value: null },
        uSdfThreshold: { value: 0.5 },
        uColor: { value: new Color(0xffffff) },
        uOpacity: { value: 1.0 },
        uFontSizePx: { value: 16.0 },
        uTextWidth: { value: 0.0 },
        uTextHeight: { value: 0.0 },
        uCenter: { value: new Vector2(0.5, 0.0) },
        uScaleByDistance: { value: 0.0 },
        uAddHeight: { value: 0.0 },
        uOffsetDepth: { value: true },
        uFarPlane: { value: 1e9 },
        rtcPos: { value: new Vector3() },
        nvr_uBatchId: { value: batchId },
        nvr_uPickable: { value: 0.0 },
        nvr_uFov: uniforms.fov,
        nvr_uScreenHeightPx: uniforms.screenHeightPx,
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    return material;
  }

  private _buildGlyphInstances(
    shapeResult: ShapeTextResult,
    atlasWidth: number,
    atlasHeight: number,
  ): void {
    const { glyphs, metrics, unitsPerEm } = shapeResult;

    // Build glyph ID -> metrics lookup
    const metricsMap = new Map<number, GlyphMetrics>();
    for (const m of metrics) {
      metricsMap.set(m.glyphId, m);
    }

    const fontUnitToSdfPx = SDF_PX_SIZE / unitsPerEm;

    // Collect renderable glyphs (those with atlas regions)
    let cursorX = 0;
    let cursorY = 0;

    const renderable: {
      offsetX: number;
      offsetY: number;
      atlasX: number;
      atlasY: number;
      atlasW: number;
      atlasH: number;
    }[] = [];

    for (const glyph of glyphs) {
      const m = metricsMap.get(glyph.glyphId);
      if (m && m.atlasW > 0 && m.atlasH > 0) {
        const x =
          (cursorX + glyph.xOffset) * fontUnitToSdfPx + m.bearingX;
        const y =
          (cursorY + glyph.yOffset) * fontUnitToSdfPx + m.bearingY;

        renderable.push({
          offsetX: x,
          offsetY: y,
          atlasX: m.atlasX,
          atlasY: m.atlasY,
          atlasW: m.atlasW,
          atlasH: m.atlasH,
        });
      }
      cursorX += glyph.xAdvance;
      cursorY += glyph.yAdvance;
    }

    const count = renderable.length;
    if (count === 0) {
      this.geometry.instanceCount = 0;
      return;
    }

    const textWidth = cursorX * fontUnitToSdfPx;
    const textHeight = SDF_PX_SIZE;

    const glyphOffsetData = new Float32Array(count * 2);
    const glyphSizeData = new Float32Array(count * 2);
    const glyphUvRectData = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const g = renderable[i];

      // Normalize by SDF_PX_SIZE so 1 unit = 1 em
      glyphOffsetData[i * 2] = g.offsetX / SDF_PX_SIZE;
      glyphOffsetData[i * 2 + 1] = g.offsetY / SDF_PX_SIZE;

      glyphSizeData[i * 2] = g.atlasW / SDF_PX_SIZE;
      glyphSizeData[i * 2 + 1] = g.atlasH / SDF_PX_SIZE;

      // UV rect in atlas
      glyphUvRectData[i * 4] = g.atlasX / atlasWidth;
      glyphUvRectData[i * 4 + 1] = g.atlasY / atlasHeight;
      glyphUvRectData[i * 4 + 2] = (g.atlasX + g.atlasW) / atlasWidth;
      glyphUvRectData[i * 4 + 3] = (g.atlasY + g.atlasH) / atlasHeight;
    }

    this.geometry.setAttribute(
      "glyphOffset",
      new InstancedBufferAttribute(glyphOffsetData, 2),
    );
    this.geometry.setAttribute(
      "glyphSize",
      new InstancedBufferAttribute(glyphSizeData, 2),
    );
    this.geometry.setAttribute(
      "glyphUvRect",
      new InstancedBufferAttribute(glyphUvRectData, 4),
    );
    this.geometry.instanceCount = count;

    // Update text dimension uniforms for centering
    this.material.uniforms.uTextWidth.value = textWidth / SDF_PX_SIZE;
    this.material.uniforms.uTextHeight.value = textHeight / SDF_PX_SIZE;
  }

  private _updateAtlasTexture(
    data: Uint8Array,
    width: number,
    height: number,
  ): void {
    if (this._atlasTexture) {
      this._atlasTexture.dispose();
    }

    const tex = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    this._atlasTexture = tex;
    this.material.uniforms.uAtlas.value = tex;
  }
}
