import { Unimplemented } from "@navara/core";
import type {
  TextMaterial as NavaraTextMaterial,
  Transform,
} from "@navara/engine";
import {
  createSdfAtlasTexture,
  type FontManager,
  type GlyphMetrics,
  type ShapeTextResult,
} from "@navara/font";
import { degreeToRadian } from "@navara/three_api";
import {
  BufferAttribute,
  type Color,
  type DataTexture,
  type PerspectiveCamera,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
} from "three";

import type { MaterialEnhancer } from "../material/enhancer/MaterialEnhancer";
import {
  createSdfTextMaterialEnhancer,
  type SdfTextBaseMutates,
  type SdfTextBaseProps,
  type SdfTextBaseState,
} from "../material/enhancer/sdfText";
import { SDF_RADIUS } from "../material/enhancer/sdfText/sdfTextBaseEnhancer/types";

import type { PickableMesh } from "./pickableMesh";

/** Must match Rust SDF_PX_SIZE in navara_font/src/resource.rs */
const SDF_PX_SIZE = 64.0;

/** Reusable Vector2 to avoid per-frame allocations in onBeforeRender. */
const _tmpSize = new Vector2();

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

  private _enhancer: MaterialEnhancer<
    ShaderMaterial,
    { base?: SdfTextBaseProps },
    SdfTextBaseState,
    SdfTextBaseMutates,
    readonly ["shader"]
  >;

  constructor(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    material: NavaraTextMaterial,
    transform: Transform,
    fontManager: FontManager,
    fontUrl: string,
    batchId: number | undefined,
    RTE: boolean,
  ) {
    super();

    this._fontManager = fontManager;
    this._fontUrl = fontUrl;

    this.geometry = this._createBaseGeometry();

    // Create empty ShaderMaterial — enhancer will set shaders and uniforms
    const mat = new ShaderMaterial({
      transparent: true,
    });

    this._enhancer = createSdfTextMaterialEnhancer(mat);

    // Mount enhancer with initial props
    this._enhancer.mount({
      base: {
        useRTE: RTE,
        color: material.color ?? 0xffffff,
        fontSize: material.size ?? 16.0,
        center: material.center
          ? [material.center.x, material.center.y]
          : undefined,
        sizeInMeters: material.sizeInMeters ?? true,
        addHeight: material.height ?? 0.0,
        offsetDepth: material.offsetDepth ?? true,
        outlineWidth: material.outlineWidth ?? 0,
        outlineColor: material.outlineColor ?? 0x000000,
        outlineOpacity: material.outlineOpacity ?? 1.0,
        showBackground: material.backgroundColor !== undefined,
        backgroundColor: material.backgroundColor,
        backgroundOutlineColor: material.borderColor ?? 0x000000,
        backgroundOutlineWidth: material.borderWidth ?? 0.1,
        depthTest: material.depthTest ?? true,
        rtcCenter: [transform.tx, transform.ty, transform.tz],
      },
    });

    // Populate uniforms early (before onBeforeCompile fires)
    const mutates = this._enhancer.mutates();
    mutates.updateUniforms(mat.uniforms, this._enhancer.states());

    // Set batch ID
    if (batchId !== undefined) {
      mutates.setBatchId(batchId);
    }

    // Set position
    mutates.setPosition(position, RTE, [
      transform.tx,
      transform.ty,
      transform.tz,
    ]);

    // Register shader hook
    mat.onBeforeCompile = this._enhancer.transformShader;
    mat.customProgramCacheKey = this._enhancer.programCacheKey;

    // Per-frame camera updates
    const state = this._enhancer.states();
    mat.onBeforeRender = (renderer, _scene, camera) => {
      const pCam = camera as PerspectiveCamera;
      mutates.updatePerFrame(
        degreeToRadian(pCam.fov),
        renderer.getDrawingBufferSize(_tmpSize).y / renderer.getPixelRatio(),
        pCam.far,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        state,
      );
    };

    this.material = mat;
    this.frustumCulled = false;
  }

  /**
   * Set a shared atlas texture. When set, setText() will skip creating its own texture.
   * The caller is responsible for the texture lifecycle.
   */
  setAtlasTexture(tex: DataTexture): void {
    this._atlasTexture = tex;
    this._sharedAtlas = true;
    this._enhancer.mutates().setAtlasTexture({ value: tex });
  }

  /**
   * Set text to render. Shapes via WASM, rebuilds instanced geometry, updates atlas texture.
   */
  setText(text: string, forceUpdate = false): void {
    if (text === this._text && !forceUpdate) return;
    this._text = text;

    if (!text) {
      this.geometry.instanceCount = 0;
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
  }

  /**
   * Update visual properties: color, size, visibility, etc.
   */
  setFont(fontUrl: string): void {
    if (fontUrl === this._fontUrl) return;
    this._fontUrl = fontUrl;

    // Clear current atlas since it's tied to the previous font
    if (!this._sharedAtlas) {
      this._atlasTexture?.dispose();
      this._atlasTexture = null;
      this._enhancer.mutates().setAtlasTexture({ value: null });
    }
  }

  setColor(color: Color): void {
    this._enhancer.update({
      base: { color: color.getHex() },
    });
  }

  setFontSize(size: number): void {
    this._enhancer.update({ base: { fontSize: size } });
  }

  setSizeInMeters(enabled: boolean): void {
    this._enhancer.update({ base: { sizeInMeters: enabled } });
  }

  setCenter(x: number, y: number): void {
    this._enhancer.update({ base: { center: [x, y] } });
  }

  setHeight(height: number): void {
    this._enhancer.update({ base: { addHeight: height } });
  }

  setPosition(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    transform: Transform,
  ): void {
    this._enhancer
      .mutates()
      .setPosition(position, RTE, [transform.tx, transform.ty, transform.tz]);
  }

  /**
   * Apply material properties from WASM TextMaterial.
   * Maps relevant properties to enhancer updates, with change tracking.
   */
  update(material: NavaraTextMaterial, forceUpdate = false): void {
    const fontUrl = material.font ?? this._fontUrl;
    this.setFont(fontUrl);

    const nextText = material.text;
    if (nextText !== undefined && nextText !== "") {
      this.setText(nextText, forceUpdate);
    } else if (forceUpdate) {
      // Font changed — re-render existing text with the new font
      this.setText(this._text, true);
    }

    this.visible = (material.show ?? true) && !!this._text;
    if (!this.visible) return;

    const state = this._enhancer.states();

    // Build props for enhancer update
    const baseProps: SdfTextBaseProps = {};
    let hasUpdate = false;

    const nextColor = material.color ?? 0xffffff;
    if (nextColor !== state.color.getHex()) {
      baseProps.color = nextColor;
      hasUpdate = true;
    }

    const nextFontSize = material.size ?? 16.0;
    if (nextFontSize !== state.fontSize) {
      baseProps.fontSize = nextFontSize;
      hasUpdate = true;
    }

    const nextCenterX = material.center?.x ?? 0.5;
    const nextCenterY = material.center?.y ?? 0.0;
    if (nextCenterX !== state.center[0] || nextCenterY !== state.center[1]) {
      baseProps.center = [nextCenterX, nextCenterY];
      hasUpdate = true;
    }

    const nextSizeInMeters = material.sizeInMeters ?? true;
    if (nextSizeInMeters !== state.sizeInMeters) {
      baseProps.sizeInMeters = nextSizeInMeters;
      hasUpdate = true;
    }

    const nextDepthTest = material.depthTest ?? true;
    if (nextDepthTest !== state.depthTest) {
      baseProps.depthTest = nextDepthTest;
      hasUpdate = true;
    }

    const nextOffsetDepth = material.offsetDepth ?? true;
    if (nextOffsetDepth !== state.offsetDepth) {
      baseProps.offsetDepth = nextOffsetDepth;
      hasUpdate = true;
    }

    const nextHeight = material.height ?? 0;
    if (nextHeight !== state.addHeight) {
      baseProps.addHeight = nextHeight;
      hasUpdate = true;
    }

    const nextOutlineWidth = material.outlineWidth ?? 0;
    if (nextOutlineWidth / SDF_RADIUS !== state.outlineWidth) {
      baseProps.outlineWidth = nextOutlineWidth;
      hasUpdate = true;
    }

    const nextOutlineColor = material.outlineColor ?? 0x000000;
    if (nextOutlineColor !== state.outlineColor.getHex()) {
      baseProps.outlineColor = nextOutlineColor;
      hasUpdate = true;
    }

    const nextOutlineOpacity = material.outlineOpacity ?? 1.0;
    if (nextOutlineOpacity !== state.outlineOpacity) {
      baseProps.outlineOpacity = nextOutlineOpacity;
      hasUpdate = true;
    }

    const nextBGColor = material.backgroundColor;
    if (nextBGColor !== undefined) {
      if (!state.showBackground) {
        baseProps.showBackground = true;
        hasUpdate = true;
      }
      if (nextBGColor !== state.backgroundColor.getHex()) {
        baseProps.backgroundColor = nextBGColor;
        hasUpdate = true;
      }
    } else if (state.showBackground) {
      baseProps.showBackground = false;
      hasUpdate = true;
    }

    const nextBGOutlineColor = material.borderColor ?? 0x000000;
    if (nextBGOutlineColor !== state.backgroundOutlineColor.getHex()) {
      baseProps.backgroundOutlineColor = nextBGOutlineColor;
      hasUpdate = true;
    }

    const nextBGOutlineWidth = material.borderWidth ?? 0;
    if (nextBGOutlineWidth !== state.backgroundOutlineWidth) {
      baseProps.backgroundOutlineWidth = nextBGOutlineWidth;
      hasUpdate = true;
    }

    if (hasUpdate) {
      this._enhancer.update({ base: baseProps });
    }
  }

  // --- FeatureMesh interface ---

  _setFeatureColor(color: Color): void {
    this.setColor(color);
  }

  _getFeatureColor(): Color {
    const state = this._enhancer.states();
    return state.color;
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
    this._enhancer.update({ base: { pickable } });
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

  private _buildGlyphInstances(
    shapeResult: ShapeTextResult,
    atlasWidth: number,
    atlasHeight: number,
  ): void {
    const { glyphs, metrics, unitsPerEm } = shapeResult;

    // Build composite key -> metrics lookup.
    // Keys are pre-computed by the WASM font worker (composite_key in Rust)
    // to ensure the key layout is always in sync between Rust and TypeScript.
    const metricsMap = new Map<bigint, GlyphMetrics>();
    for (const m of metrics) {
      metricsMap.set(m.compositeKey, m);
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
      const m = metricsMap.get(glyph.compositeKey);
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

    // Update text dimension uniforms via mutates
    this._enhancer
      .mutates()
      .updateTextDimensions(
        textWidth / SDF_PX_SIZE,
        textHeight / SDF_PX_SIZE,
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
      // Update existing texture in-place (atlas dimensions are constant)
      this._atlasTexture.image = { data, width, height };
      this._atlasTexture.needsUpdate = true;
      return;
    }

    const tex = createSdfAtlasTexture(data, width, height);
    this._atlasTexture = tex;
    this._enhancer.mutates().setAtlasTexture({ value: tex });
  }
}
