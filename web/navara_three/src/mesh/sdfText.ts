import { Unimplemented } from "@navara/core";
import type {
  TextMaterial as NavaraTextMaterial,
  Transform,
} from "@navara/engine";
import { encodePosition } from "@navara/engine-api";
import sdfTextFragmentShader from "@shaders/glsl/sdfText.frag.glsl";
import sdfTextVertexShader from "@shaders/glsl/sdfText.vert.glsl";
import {
  BufferAttribute,
  Color,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";

import {
  createSdfAtlasTexture,
  type FontManager,
  type GlyphMetrics,
  type ShapeTextResult,
} from "../font/FontManager";

import type { PickableMesh } from "./pickableMesh";

/** Must match Rust SDF_PX_SIZE in navara_font/src/resource.rs */
const SDF_PX_SIZE = 64.0;

/**
 * A text mesh that renders glyphs from an SDF atlas using instanced geometry.
 *
 * Each glyph is an instanced unit quad positioned by shaping data,
 * sampling from a per-font SDF atlas texture. Uses billboard rendering
 * so text always faces the camera.
 */
export class SDFTextMesh
  extends Mesh<InstancedBufferGeometry, ShaderMaterial>
  implements PickableMesh
{
  private _fontManager: FontManager;
  private _fontUrl: string;
  private _text = "";
  private _atlasTexture: DataTexture | null = null;
  /** When true, the atlas texture is shared and should not be disposed by this mesh. */
  private _sharedAtlas = false;

  constructor(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    material: NavaraTextMaterial,
    transform: Transform,
    fontManager: FontManager,
    fontUrl: string,
    batchId: number | undefined,
    RTE: boolean,
    active: boolean,
  ) {
    super();

    this._fontManager = fontManager;
    this._fontUrl = fontUrl;

    this.geometry = this._createBaseGeometry();
    this.material = this._createMaterial(
      position,
      RTE,
      material,
      transform,
      batchId,
      active,
    );
    this.frustumCulled = false;
  }

  /**
   * Set a shared atlas texture. When set, setText() will skip creating its own texture.
   * The caller is responsible for the texture lifecycle.
   */
  setAtlasTexture(tex: DataTexture): void {
    this._atlasTexture = tex;
    this._sharedAtlas = true;
    this.material.uniforms.uAtlas.value = tex;
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

    // Skip texture creation if using a shared atlas from the parent container
    if (!this._sharedAtlas) {
      this._updateAtlasTexture(
        atlasData.data,
        atlasData.width,
        atlasData.height,
      );
    }

    this.visible = true;
  }

  /**
   * Update visual properties: color, size, visibility, etc.
   */
  setColor(color: Color): void {
    this.material.uniforms.uColor.value.set(color.r, color.g, color.b);
  }

  setFontSize(sizePx: number): void {
    this.material.uniforms.uFontSizePx.value = sizePx;
  }

  setScaleByDistance(enabled: boolean): void {
    this.material.uniforms.uScaleByDistance.value = enabled;
  }

  setCenter(x: number, y: number): void {
    this.material.uniforms.uCenter.value.set(x, y);
  }

  setHeight(height: number): void {
    this.material.uniforms.uAddHeight.value = height;
  }

  setPosition(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    transform: Transform,
  ): void {
    if (RTE) {
      const p = position as { high: Float32Array; low: Float32Array };
      this.material.uniforms.uRTEPositionLOW.value.set(
        p.low[0],
        p.low[1],
        p.low[2] ?? 0.0,
      );
      this.material.uniforms.uRTEPositionHIGH.value.set(
        p.high[0],
        p.high[1],
        p.high[2] ?? 0.0,
      );
    } else {
      const p = position as Float32Array;
      this.material.uniforms.uRTCPosition.value.set(p[0], p[1], p[2] ?? 0.0);

      const rtcCenter = new Vector3(transform.tx, transform.ty, transform.tz);
      this.material.uniforms.uRTCCenter.value.set(
        rtcCenter.x,
        rtcCenter.y,
        rtcCenter.z,
      );
    }
  }

  /**
   * Apply material properties from WASM TextMaterial.
   * Maps relevant properties to SDFTextMesh setters, with change tracking.
   */
  // TODO: cleanup
  update(material: NavaraTextMaterial, _active: boolean): void {
    if (!this.userData.prev) {
      this.userData.prev = {};
    }
    const prev = this.userData.prev;

    const nextVisible = material.show ?? true;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }
    if (!nextVisible) return;

    const nextText = material.text;
    if (nextText !== prev.text) {
      prev.text = nextText;
      this.setText(nextText ?? "");
    }

    const nextColor = material.color ?? 0xffffff;
    if (nextColor !== prev.color) {
      prev.color = nextColor;
      const color = new Color().setHex(nextColor);
      this.material.uniforms.uColor.value.set(color.r, color.g, color.b);
    }

    const nextFontSize = material.size ?? 16.0;
    if (nextFontSize !== prev.fontSize) {
      prev.fontSize = nextFontSize;
      this.setFontSize(nextFontSize);
    }

    const nextCenterX = material.center?.x ?? 0;
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

    const nextOutlineWidth = material.outlineWidth ?? 0;
    if (nextOutlineWidth !== prev.outlineWidth) {
      prev.outlineWidth = nextOutlineWidth;
      this.material.uniforms.uOutlineWidth.value = nextOutlineWidth;
    }

    const nextOutlineColor = material.outlineColor ?? 0x000000;
    if (nextOutlineColor !== prev.outlineColor) {
      prev.outlineColor = nextOutlineColor;
      const color = new Color().setHex(nextOutlineColor);
      this.material.uniforms.uOutlineColor.value.set(color.r, color.g, color.b);
    }

    const nextOutlineOpacity = material.outlineOpacity ?? 1.0;
    if (nextOutlineOpacity !== prev.outlineOpacity) {
      prev.outlineOpacity = nextOutlineOpacity;
      this.material.uniforms.uOutlineOpacity.value = nextOutlineOpacity;
    }

    const nextBGColor = material.backgroundColor;
    if (nextBGColor !== undefined) {
      if (nextBGColor !== prev.backgroundColor) {
        prev.backgroundColor = nextBGColor;
        const color = new Color().setHex(nextBGColor);
        this.material.uniforms.uBackgroundColor.value.set(
          color.r,
          color.g,
          color.b,
        );
        this.material.uniforms.uShowBackground.value = true;
      }
    } else {
      this.material.uniforms.uShowBackground.value = false;
    }

    const nextBGRadius = material.cornerRadius ?? 0;
    if (nextBGRadius !== prev.cornerRadius) {
      prev.cornerRadius = nextBGRadius;
      this.material.uniforms.uBackgroundRadius.value = nextBGRadius;
    }

    const nextBGOutlineColor = material.borderColor ?? 0x000000;
    if (nextBGOutlineColor !== prev.backgroundOutlineColor) {
      prev.backgroundOutlineColor = nextBGOutlineColor;
      const color = new Color().setHex(nextBGOutlineColor);
      this.material.uniforms.uBackgroundOutlineColor.value.set(
        color.r,
        color.g,
        color.b,
      );
    }

    const nextBGOutlineWidth = material.borderWidth ?? 0;
    if (nextBGOutlineWidth !== prev.backgroundOutlineWidth) {
      prev.backgroundOutlineWidth = nextBGOutlineWidth;
      this.material.uniforms.uBackgroundOutlineWidth.value = nextBGOutlineWidth;
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
  }

  // --- Cleanup ---

  dispose(): void {
    this.geometry?.dispose();
    if (!this._sharedAtlas) {
      this._atlasTexture?.dispose();
    }
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

    geo.setAttribute(
      "glyphOffset",
      new InstancedBufferAttribute(new Float32Array(), 2),
    );
    geo.setAttribute(
      "glyphSize",
      new InstancedBufferAttribute(new Float32Array(), 2),
    );
    geo.setAttribute(
      "glyphUvRect",
      new InstancedBufferAttribute(new Float32Array(), 4),
    );

    geo.instanceCount = 0;

    return geo;
  }

  private _createMaterial(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    material: NavaraTextMaterial,
    transform: Transform,
    batchId: number | undefined,
    _active: boolean,
  ): ShaderMaterial {
    const rtcCenter = new Vector3(transform.tx, transform.ty, transform.tz);

    const m = new ShaderMaterial({
      vertexShader: sdfTextVertexShader,
      fragmentShader: sdfTextFragmentShader,
      uniforms: {
        uAtlas: { value: null },
        uSdfThreshold: { value: 0.5 },
        uColor: { value: new Color(1, 1, 1) },
        uShowBackground: { value: false },
        uBackgroundColor: { value: new Color(1, 0, 0) },
        uBackgroundOutlineColor: { value: new Color(1, 0, 0) },
        uBackgroundOutlineWidth: { value: 0.1 },
        uBackgroundRadius: { value: 0.1 },
        uBgYBounds: { value: new Vector2(0.0, 1.0) },
        uOutlineColor: { value: new Color(1, 0, 0) },
        uOutlineWidth: { value: 0.1 },
        uOutlineOpacity: { value: 0.1 },
        uFontSizePx: { value: 16.0 },
        uTextWidth: { value: 0.0 },
        uTextHeight: { value: 0.0 },
        uCenter: {
          value: material.center
            ? new Vector2(material.center.x, material.center.y)
            : new Vector2(0.0, 0.0),
        },
        uScaleByDistance: { value: material.scaleByDistance ?? false },
        uFov: { value: 1.0 },
        uScreenHeightPx: { value: 1080.0 },
        uAddHeight: { value: material.height ?? 0.0 },
        uOffsetDepth: { value: material.offsetDepth ?? true },
        uRTCCenter: { value: rtcCenter },
        uEyeRTELow: { value: new Vector3() },
        uEyeRTEHigh: { value: new Vector3() },
        uFarPlane: { value: 1000.0 },
        nvr_uBatchId: { value: batchId ?? 0 },
        nvr_uPickable: { value: 0.0 },
      },
      transparent: true,
      depthTest: true,
    });

    if (RTE) {
      m.defines = { USE_RTE: 1 };
      const p = {
        low: (position as { low: Float32Array }).low,
        high: (position as { high: Float32Array }).high,
      };
      m.uniforms.uRTEPositionLOW = {
        value: new Vector3(p.low[0], p.low[1], p.low[2] ?? 0.0),
      };
      m.uniforms.uRTEPositionHIGH = {
        value: new Vector3(p.high[0], p.high[1], p.high[2] ?? 0.0),
      };
    } else {
      const p = position as Float32Array;
      m.uniforms.uRTCPosition = { value: new Vector3(p[0], p[1], p[2] ?? 0.0) };
    }

    m.onBeforeRender = (renderer, _scene, camera, _geometry, _mat, _group) => {
      const pCam = camera as PerspectiveCamera;
      m.uniforms.uFarPlane.value = pCam.far;
      m.uniforms.uFov.value = pCam.fov * (Math.PI / 180.0);
      m.uniforms.uScreenHeightPx.value = renderer.getDrawingBufferSize(
        new Vector2(),
      ).height;

      if (RTE) {
        const encodedCamPos = encodePosition(
          camera.position.x,
          camera.position.y,
          camera.position.z,
        );
        m.uniforms.uEyeRTELow.value.set(
          encodedCamPos.low.x,
          encodedCamPos.low.y,
          encodedCamPos.low.z,
        );
        m.uniforms.uEyeRTEHigh.value.set(
          encodedCamPos.high.x,
          encodedCamPos.high.y,
          encodedCamPos.high.z,
        );
      }
    };

    return m;
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
        const x = (cursorX + glyph.xOffset) * fontUnitToSdfPx + m.bearingX;
        const y = (cursorY + glyph.yOffset) * fontUnitToSdfPx + m.bearingY;

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

    const glyphOffsetData = new Float32Array((count + 1) * 2);
    const glyphSizeData = new Float32Array((count + 1) * 2);
    const glyphUvRectData = new Float32Array((count + 1) * 4);

    // Compute actual Y bounding box of all rendered glyphs
    let bgMinY = Infinity;
    let bgMaxY = -Infinity;

    // Index 0 is reserved for the background instance (drawn first).
    // Glyph data starts at index 1.
    for (let i = 0; i < count; i++) {
      const g = renderable[i];
      const j = i + 1; // offset by 1 to leave index 0 for background

      // Normalize by SDF_PX_SIZE so 1 unit = 1 em
      const normOffsetY = g.offsetY / SDF_PX_SIZE;
      const normSizeY = g.atlasH / SDF_PX_SIZE;

      glyphOffsetData[j * 2] = g.offsetX / SDF_PX_SIZE;
      glyphOffsetData[j * 2 + 1] = normOffsetY;

      glyphSizeData[j * 2] = g.atlasW / SDF_PX_SIZE;
      glyphSizeData[j * 2 + 1] = normSizeY;

      bgMinY = Math.min(bgMinY, normOffsetY);
      bgMaxY = Math.max(bgMaxY, normOffsetY + normSizeY);

      // UV rect in atlas
      glyphUvRectData[j * 4] = g.atlasX / atlasWidth;
      glyphUvRectData[j * 4 + 1] = g.atlasY / atlasHeight;
      glyphUvRectData[j * 4 + 2] = (g.atlasX + g.atlasW) / atlasWidth;
      glyphUvRectData[j * 4 + 3] = (g.atlasY + g.atlasH) / atlasHeight;
    }

    // Recreate geometry if instance count increased beyond current capacity
    if (this.geometry.instanceCount < count + 1) {
      this.geometry.dispose();
      this.geometry = this._createBaseGeometry();
    }

    if (this.geometry.hasAttribute("glyphOffset")) {
      this.geometry.deleteAttribute("glyphOffset");
    }
    this.geometry.setAttribute(
      "glyphOffset",
      new InstancedBufferAttribute(glyphOffsetData, 2),
    );

    if (this.geometry.hasAttribute("glyphSize")) {
      this.geometry.deleteAttribute("glyphSize");
    }
    this.geometry.setAttribute(
      "glyphSize",
      new InstancedBufferAttribute(glyphSizeData, 2),
    );

    if (this.geometry.hasAttribute("glyphUvRect")) {
      this.geometry.deleteAttribute("glyphUvRect");
    }
    this.geometry.setAttribute(
      "glyphUvRect",
      new InstancedBufferAttribute(glyphUvRectData, 4),
    );

    this.geometry.instanceCount = count + 1;

    // Update text dimension uniforms for centering
    this.material.uniforms.uTextWidth.value = textWidth / SDF_PX_SIZE;
    this.material.uniforms.uTextHeight.value = textHeight / SDF_PX_SIZE;
    this.material.uniforms.uBgYBounds.value.set(
      bgMinY === Infinity ? 0.0 : bgMinY,
      bgMaxY === -Infinity ? 1.0 : bgMaxY,
    );
  }

  private _updateAtlasTexture(
    data: Uint8Array,
    width: number,
    height: number,
  ): void {
    if (this._atlasTexture) {
      this._atlasTexture.dispose();
    }

    const tex = createSdfAtlasTexture(data, width, height);
    this._atlasTexture = tex;
    this.material.uniforms.uAtlas.value = tex;
  }
}
