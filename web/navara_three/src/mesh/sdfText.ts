import { Unimplemented } from "@navaramap/core";
import type {
  TextMaterial as NavaraTextMaterial,
  Transform,
} from "@navaramap/engine";
import {
  COLOR_GLYPH_PX_SIZE,
  GlyphCharClass,
  createSdfAtlasTexture,
  type FontManager,
  type GlyphMetrics,
  type ShapedGlyph,
  type ShapeTextResult,
} from "@navaramap/font";
import { degreeToRadian } from "@navaramap/three_api";
import {
  BufferAttribute,
  type Color,
  type DataTexture,
  type PerspectiveCamera,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Object3D,
  ShaderMaterial,
  Vector2,
} from "three";

import {
  DECLUTTER_FADE_MS,
  type DeclutterCandidate,
  type DeclutterParticipant,
} from "../declutter/types";
import type { MaterialEnhancer } from "../material/enhancer/MaterialEnhancer";
import {
  createSdfTextMaterialEnhancer,
  type SdfTextBaseMutates,
  type SdfTextBaseProps,
  type SdfTextBaseState,
} from "../material/enhancer/sdfText";
import { sdfRadiusFor } from "../material/enhancer/sdfText/sdfTextBaseEnhancer/types";

import type { PickableMesh } from "./pickableMesh";

/** Must match Rust `SDF_PX_SIZE` in `crates/navara_wasm_font_worker/src/atlas.rs`. */
const SDF_PX_SIZE = 64.0;

/** Reusable Vector2 to avoid per-frame allocations in onBeforeRender. */
const _tmpSize = new Vector2();

/** Horizontal alignment of lines within a multi-line block, as the fraction
 *  of leftover width placed before each line. */
const ALIGN_FACTORS: Record<string, number> = {
  left: 0,
  center: 0.5,
  right: 1,
};

/** Line width in font units: advances summed, trailing whitespace ignored so
 *  it never affects alignment or the block width. Exported for tests. */
export function lineWidthFu(line: ShapedGlyph[]): number {
  let end = line.length;
  while (end > 0 && line[end - 1].charClass === GlyphCharClass.Whitespace) {
    end--;
  }
  let width = 0;
  for (let i = 0; i < end; i++) width += line[i].xAdvance;
  return width;
}

/** Strong RTL code points (Hebrew through Arabic Extended, presentation
 *  forms, and the supplementary-plane RTL blocks). Used for first-strong
 *  paragraph direction detection, mirroring the shaper's own direction guess.
 */
const STRONG_RTL_RE =
  /[\u0591-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;

/** Paragraph direction from the first strong directional character (UAX #9
 *  P2/P3 approximation): the first letter decides, RTL ranges win over other
 *  letters. Exported for tests. */
export function isRtlText(text: string): boolean {
  for (const ch of text) {
    if (STRONG_RTL_RE.test(ch)) return true;
    if (/\p{L}/u.test(ch)) return false;
  }
  return false;
}

/**
 * Split a shaped glyph run into lines: hard breaks at newline markers, greedy
 * soft breaks at the last whitespace/ideographic glyph when a line would
 * exceed `maxWidthFu` (font units; 0 disables wrapping). A word longer than
 * the wrap width overflows rather than breaking mid-word.
 *
 * When `rtl` is set, glyphs are assumed to arrive in visual order (leftmost
 * first — how the shaper emits RTL runs), i.e. reversed logical order. Each
 * hard-break segment is wrapped in logical order so the greedy fill starts at
 * the sentence start and lines stack top-to-bottom in reading order, then
 * every line is flipped back to visual order for rendering. Mixed-direction
 * lines may still break sub-optimally — same trade other map renderers make.
 * Exported for tests.
 */
export function breakLines(
  glyphs: ShapedGlyph[],
  maxWidthFu: number,
  rtl = false,
): ShapedGlyph[][] {
  const lines: ShapedGlyph[][] = [];

  const pushSegment = (segment: ShapedGlyph[]) => {
    if (!rtl) {
      lines.push(...wrapSegment(segment, maxWidthFu));
      return;
    }
    segment.reverse();
    for (const line of wrapSegment(segment, maxWidthFu)) {
      lines.push(line.reverse());
    }
  };

  let segment: ShapedGlyph[] = [];
  for (const g of glyphs) {
    if (g.charClass === GlyphCharClass.Newline) {
      pushSegment(segment);
      segment = [];
    } else {
      segment.push(g);
    }
  }
  pushSegment(segment);
  return lines;
}

/** Greedy soft-wrap of a single hard-break-free segment in logical order. */
function wrapSegment(
  glyphs: ShapedGlyph[],
  maxWidthFu: number,
): ShapedGlyph[][] {
  const lines: ShapedGlyph[][] = [];
  let line: ShapedGlyph[] = [];
  let width = 0;
  let breakIdx = -1; // index in `line` of the last break opportunity

  for (const g of glyphs) {
    // Trailing whitespace is invisible at a line end, so it never triggers a
    // wrap itself — it just gets trimmed if a later glyph wraps.
    if (
      maxWidthFu > 0 &&
      g.charClass !== GlyphCharClass.Whitespace &&
      line.length > 0 &&
      breakIdx >= 0 &&
      width + g.xAdvance > maxWidthFu
    ) {
      const head = line.slice(0, breakIdx + 1);
      while (
        head.length > 0 &&
        head[head.length - 1].charClass === GlyphCharClass.Whitespace
      ) {
        head.pop();
      }
      lines.push(head);

      const tail = line.slice(breakIdx + 1);
      const start = tail.findIndex(
        (gg) => gg.charClass !== GlyphCharClass.Whitespace,
      );
      line = start === -1 ? [] : tail.slice(start);

      width = 0;
      for (const rest of line) width += rest.xAdvance;
      breakIdx = -1;
    }

    line.push(g);
    width += g.xAdvance;
    if (
      g.charClass === GlyphCharClass.Whitespace ||
      g.charClass === GlyphCharClass.Ideographic
    ) {
      breakIdx = line.length - 1;
    }
  }

  lines.push(line);
  return lines;
}

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
  /** Per-material text quality. Immutable after construction — switching
   *  quality requires a separate (font, atlas) pair, so callers create a new
   *  mesh rather than mutating this one. */
  private _highQuality: boolean;
  private _text = "";
  /** Wrap width in ems (multiples of font size); 0 disables soft wrapping. */
  private _maxWidth = 0;
  /** Multiplier on the font's natural line height (ascender − descender + gap). */
  private _lineHeight = 1.0;
  /** Alignment factor for multi-line blocks: 0 left, 0.5 center, 1 right. */
  private _textAlign = 0.5;
  private _atlasTexture: DataTexture | null = null;
  /** Atlas texture is owned externally; do not dispose on cleanup when true. */
  private _sharedAtlas = false;
  /** Unique atlas glyphs this mesh currently renders (composite keys). */
  private _glyphKeys: bigint[] = [];
  /** The glyph set currently retained in the atlas (one visible-label
   *  reference per key), or null when this mesh holds no references. */
  private _retainedKeys: bigint[] | null = null;
  /** Re-prepare a text in the worker (re-rasterizing evicted glyphs) using the
   *  owner's font identity and loaded faces. Set by the parent batch. */
  private _reprepare?: (text: string) => Promise<void>;
  /** Ask the owner to schedule a render after an async re-prepare. */
  private _requestRender?: () => void;
  // The COLRv1 color atlas is always FontManager-owned; no local field needed.

  /** World-space anchor in ECEF meters (f64), kept in sync with the position
   *  uniforms so the declutter pass can project it without touching WASM. */
  private _worldAnchor = new Float64Array(3);
  /** Whether this label participates in screen-space decluttering. */
  private _declutter = false;
  /** Layer-level placement priority from the material. */
  private _declutterPriority = 0;
  /** Per-feature priority set through the evaluator; overrides the layer
   *  value when defined. */
  private _declutterPriorityOverride: number | undefined;
  /** Current animated hide factor (mirrors the uDeclutterHide uniform) and
   *  the placement target it is fading toward. */
  private _declutterHide = 0;
  private _declutterTarget = 0;
  /** Text block dimensions in em units, mirroring the uTextWidth/uTextHeight/
   *  uBgYBounds uniforms; 0 width means "no collision box" (empty text). */
  private _labelWidthEm = 0;
  private _labelHeightEm = 0;
  private _labelMinYEm = 0;
  private _labelMaxYEm = 0;

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
    // Quality is fixed by the owning batch (flipping it needs a new batch), so
    // it is passed in rather than re-derived from `material.highQuality` — the
    // stored material can carry a newer, mismatched value by the time a mesh is
    // created lazily, which must not diverge from the batch's atlas/shaping.
    highQuality: boolean,
  ) {
    super();

    this._fontManager = fontManager;
    this._fontUrl = fontUrl;
    this._highQuality = highQuality;
    this._maxWidth = material.maxWidth ?? 0;
    this._lineHeight = material.lineHeight ?? 1.0;
    this._textAlign = ALIGN_FACTORS[material.textAlign ?? "center"] ?? 0.5;

    this.geometry = this._createBaseGeometry();

    // Create empty ShaderMaterial — enhancer will set shaders and uniforms
    const mat = new ShaderMaterial({
      transparent: true,
      // depthWrite must stay enabled: the fragment shader's per-pixel outline
      // depth offset (sdfText.frag.glsl) relies on fills writing a nearer depth
      // so a neighbouring glyph's fill occludes this glyph's outline at overlaps
      // — without depth writes that outline-seam fix becomes a no-op.
      depthWrite: true,
    });

    this._enhancer = createSdfTextMaterialEnhancer(mat);

    // Mount enhancer with initial props
    // Validate and clamp opacity values to prevent invalid alpha in shader
    const initialOpacity = Number.isFinite(material.opacity ?? 1.0)
      ? Math.max(0, Math.min(1, material.opacity ?? 1.0))
      : 1.0;
    const initialOutlineOpacity = Number.isFinite(
      material.outlineOpacity ?? 1.0,
    )
      ? Math.max(0, Math.min(1, material.outlineOpacity ?? 1.0))
      : 1.0;

    this._enhancer.mount({
      base: {
        useRTE: RTE,
        useMsdf: this._highQuality,
        color: material.color ?? 0xffffff,
        opacity: initialOpacity,
        fontSize: material.size ?? 16.0,
        center: material.center
          ? [material.center.x, material.center.y]
          : undefined,
        sizeInMeters: material.sizeInMeters ?? true,
        addHeight: material.height ?? 0.0,
        offsetDepth: material.offsetDepth ?? true,
        outlineWidth: material.outlineWidth ?? 0,
        outlineColor: material.outlineColor ?? 0x000000,
        outlineOpacity: initialOutlineOpacity,
        showBackground: material.backgroundColor !== undefined,
        backgroundColor: material.backgroundColor,
        backgroundOutlineColor: material.borderColor ?? 0x000000,
        backgroundOutlineWidth: material.borderWidth ?? 0.1,
        depthTest: material.depthTest ?? true,
        transparent: material.transparent ?? true,
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
    this._cacheWorldAnchor(position, RTE, [
      transform.tx,
      transform.ty,
      transform.tz,
    ]);

    // Decluttered labels start hidden and fade in once the placement pass
    // grants them space — otherwise dense tiles flash their full clutter for
    // a frame before the first pass runs.
    this._declutter = material.declutter ?? true;
    this._declutterPriority = material.declutterPriority ?? 0;
    if (this._declutter) {
      this._declutterHide = 1;
      this._declutterTarget = 1;
      mutates.setDeclutterHide(1);
    }

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
        camera.matrixWorldInverse,
        state,
      );
      // Keep atlas-size uniforms in sync with the (possibly resized) shared
      // DataTexture so glyph pixel rects always normalize to the right UV.
      mutates.updateAtlasSizes();
    };

    this.material = mat;
    this.frustumCulled = false;
  }

  /** The text this mesh currently renders (its baked glyph string). */
  get text(): string {
    return this._text;
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
   * Set a shared color (COLRv1 RGBA) atlas texture.
   * Pass `null` to clear when the font has no color glyphs.
   */
  setColorAtlasTexture(tex: DataTexture | null): void {
    this._enhancer.mutates().setColorAtlasTexture({ value: tex });
  }

  /**
   * Wire the callbacks the parent batch uses to re-prepare evicted glyphs and
   * request a render. `reprepare` must apply the batch's font identity and
   * loaded faces so font refcounts stay balanced.
   */
  setGlyphLifecycleHandlers(
    reprepare: (text: string) => Promise<void>,
    requestRender: () => void,
  ): void {
    this._reprepare = reprepare;
    this._requestRender = requestRender;
  }

  /** Replace the retained glyph set, releasing the old references and (if
   *  visible) retaining the new ones. */
  private _setGlyphKeys(keys: bigint[]): void {
    if (this._retainedKeys) {
      this._fontManager.releaseGlyphs(
        this._fontUrl,
        this._highQuality,
        this._retainedKeys,
      );
      this._retainedKeys = null;
    }
    this._glyphKeys = keys;
    this._syncGlyphRefs();
  }

  /** Reconcile atlas references with current visibility: retain glyphs while
   *  on screen, release them when hidden. If shown after the glyphs were
   *  evicted (cache no longer prepared), re-prepare to re-rasterize them and
   *  rebuild with fresh metrics. */
  private _syncGlyphRefs(): void {
    const visible = this.visible && this._glyphKeys.length > 0;

    if (visible && !this._retainedKeys) {
      if (
        this._reprepare &&
        !this._fontManager.isTextPrepared(
          this._fontUrl,
          this._text,
          this._highQuality,
        )
      ) {
        // Glyphs were evicted while hidden; re-rasterize then rebuild (which
        // re-enters here with the fresh set and retains it).
        const text = this._text;
        this._reprepare(text)
          .then(() => {
            if (this._text === text) {
              this.setText(text, true);
              this._requestRender?.();
            }
          })
          .catch((err: unknown) => {
            console.error("SDFTextMesh: re-prepare on show failed:", err);
          });
        return;
      }
      this._fontManager.retainGlyphs(
        this._fontUrl,
        this._highQuality,
        this._glyphKeys,
      );
      this._retainedKeys = this._glyphKeys;
    } else if (!visible && this._retainedKeys) {
      this._fontManager.releaseGlyphs(
        this._fontUrl,
        this._highQuality,
        this._retainedKeys,
      );
      this._retainedKeys = null;
    }
  }

  /**
   * Set text to render. Shapes via WASM, rebuilds instanced geometry, updates atlas texture.
   */
  setText(text: string, forceUpdate = false): void {
    if (text === this._text && !forceUpdate) return;
    this._text = text;

    if (!text) {
      this.geometry.instanceCount = 0;
      this._labelWidthEm = 0;
      this._setGlyphKeys([]);
      return;
    }

    const shapeResult = this._fontManager.shapeText(
      this._fontUrl,
      text,
      this._highQuality,
    );
    if (!shapeResult) {
      this.geometry.instanceCount = 0;
      this._labelWidthEm = 0;
      this._setGlyphKeys([]);
      return;
    }

    const atlasData = this._fontManager.getAtlas(
      this._fontUrl,
      this._highQuality,
    );
    if (!atlasData) return;

    // Glyph rects are stored in pixel space and normalized in the shader using
    // uSdfAtlasSize / uColorAtlasSize, so atlas dimensions aren't needed here.
    this._buildGlyphInstances(shapeResult);

    // Skip texture creation if using a shared atlas from the parent container
    if (!this._sharedAtlas) {
      this._updateAtlasTexture(
        atlasData.data,
        atlasData.width,
        atlasData.height,
        atlasData.channels,
      );
    }
  }

  /**
   * Update visual properties: color, size, visibility, etc.
   */
  setFont(fontUrl: string): void {
    if (fontUrl === this._fontUrl) return;

    // Release glyph references against the old font before switching; the
    // baked instances are about to be rebuilt for the new font anyway.
    if (this._retainedKeys) {
      this._fontManager.releaseGlyphs(
        this._fontUrl,
        this._highQuality,
        this._retainedKeys,
      );
      this._retainedKeys = null;
    }
    this._glyphKeys = [];
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

  setSize(size: number): void {
    const currentFontSize = this._enhancer.states().fontSize;
    const sanitizedSize = Number.isFinite(size)
      ? Math.max(0.0, size)
      : currentFontSize;
    this._enhancer.update({ base: { fontSize: sanitizedSize } });
  }

  setOpacity(opacity: number): void {
    const clampedOpacity = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1.0;
    this._enhancer.update({ base: { opacity: clampedOpacity } });
  }

  /**
   * Set this label's declutter fade target; the actual hide factor animates
   * toward it in {@link stepDeclutterFade}. Deliberately separate from
   * `visible`/`show`: it neither churns scene-graph membership nor releases
   * glyph atlas retains, so the declutter pass can retarget it every
   * placement run at no cost.
   */
  setDeclutterHidden(hidden: boolean): void {
    this._declutterTarget = hidden ? 1 : 0;
  }

  /**
   * Advance the hide factor toward its target by `deltaMs / DECLUTTER_FADE_MS`
   * and push it to the uniform. Returns true while still mid-fade.
   */
  stepDeclutterFade(deltaMs: number): boolean {
    const target = this._declutterTarget;
    let value = this._declutterHide;
    if (value === target) return false;

    const step = deltaMs / DECLUTTER_FADE_MS;
    value =
      value < target
        ? Math.min(value + step, target)
        : Math.max(value - step, target);
    this._declutterHide = value;
    this._enhancer.mutates().setDeclutterHide(value);
    return value !== target;
  }

  _setFeatureWidth(_width: number): void {
    // Width is not applicable to text meshes.
    // This method is intentionally a no-op to satisfy the FeatureMesh guard.
  }
  _setFeatureOpacity(opacity: number): void {
    const clampedOpacity = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1.0;
    this._enhancer.update({ base: { opacity: clampedOpacity } });
  }

  setPosition(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    transform: Transform,
  ): void {
    this._enhancer
      .mutates()
      .setPosition(position, RTE, [transform.tx, transform.ty, transform.tz]);
    this._cacheWorldAnchor(position, RTE, [
      transform.tx,
      transform.ty,
      transform.tz,
    ]);
  }

  /** Reconstruct the absolute ECEF anchor from the same inputs the position
   *  uniforms receive (RTE high+low split, or RTC-relative + center). */
  private _cacheWorldAnchor(
    position: Float32Array | { high: Float32Array; low: Float32Array },
    RTE: boolean,
    rtcCenter: [number, number, number],
  ): void {
    const anchor = this._worldAnchor;
    if (RTE) {
      const p = position as { high: Float32Array; low: Float32Array };
      anchor[0] = p.high[0] + p.low[0];
      anchor[1] = p.high[1] + p.low[1];
      anchor[2] = (p.high[2] ?? 0.0) + (p.low[2] ?? 0.0);
    } else {
      const p = position as Float32Array;
      anchor[0] = p[0] + rtcCenter[0];
      anchor[1] = p[1] + rtcCenter[1];
      anchor[2] = (p[2] ?? 0.0) + rtcCenter[2];
    }
  }

  /**
   * Build this label's collision candidate for the shared declutter pass, or
   * null when it doesn't participate (declutter disabled, hidden, or empty).
   * The local box mirrors the vertex shader's layout: glyphs span
   * [0, textWidth] × [bgMinY, bgMaxY] in em units, shifted by the `center`
   * anchor and scaled by the font size (sdfText.vert.glsl:111-115).
   */
  getDeclutterCandidate(
    owner: DeclutterParticipant,
    handle: number,
  ): DeclutterCandidate | null {
    if (!this._declutter || !this.visible || this._labelWidthEm <= 0) {
      return null;
    }
    const state = this._enhancer.states();
    const size = state.fontSize;
    if (size <= 0) return null;

    const cx = Math.min(Math.max(state.center[0], -0.5), 0.5);
    const cy = Math.min(Math.max(state.center[1], -0.5), 0.5);
    const w = this._labelWidthEm;
    const h = this._labelHeightEm;
    return {
      anchorX: this._worldAnchor[0],
      anchorY: this._worldAnchor[1],
      anchorZ: this._worldAnchor[2],
      addHeight: state.addHeight,
      minX: (0 - cx * w) * size,
      maxX: (w - cx * w) * size,
      minY: (this._labelMinYEm - cy * h) * size,
      maxY: (this._labelMaxYEm - cy * h) * size,
      sizeInMeters: state.sizeInMeters,
      priority: this._declutterPriorityOverride ?? this._declutterPriority,
      isShown: this._declutterTarget === 0,
      owner,
      handle,
    };
  }

  /**
   * Set a per-feature placement priority (higher wins), overriding the
   * layer-level `declutterPriority` for this label. Pass `undefined` to fall
   * back to the layer value. Driven by the feature evaluator.
   */
  setDeclutterPriority(priority: number | undefined): void {
    this._declutterPriorityOverride = priority;
  }

  /**
   * Apply material properties from WASM TextMaterial.
   * Maps relevant properties to enhancer updates, with change tracking.
   */
  update(material: NavaraTextMaterial, forceUpdate = false): void {
    const fontUrl = material.font ?? this._fontUrl;
    this.setFont(fontUrl);

    // Layout properties are baked into the glyph instance geometry, so a
    // change forces a rebuild even when the text itself is unchanged.
    const nextMaxWidth = material.maxWidth ?? 0;
    const nextLineHeight = material.lineHeight ?? 1.0;
    const nextTextAlign = ALIGN_FACTORS[material.textAlign ?? "center"] ?? 0.5;
    const layoutChanged =
      nextMaxWidth !== this._maxWidth ||
      nextLineHeight !== this._lineHeight ||
      nextTextAlign !== this._textAlign;
    this._maxWidth = nextMaxWidth;
    this._lineHeight = nextLineHeight;
    this._textAlign = nextTextAlign;

    const nextText = material.text;
    if (nextText !== undefined && nextText !== "") {
      this.setText(nextText, forceUpdate || layoutChanged);
    } else if (forceUpdate || layoutChanged) {
      // Font or layout changed — re-render existing text with the new settings
      this.setText(this._text, true);
    }

    // Read before the visibility early-return: the declutter pass consults
    // these even while other style state is skipped for hidden labels.
    const nextDeclutter = material.declutter ?? true;
    if (this._declutter && !nextDeclutter) {
      // Leaving declutter mode: clear any hide the pass applied — the mesh
      // stops producing candidates, so nothing else would ever re-show it.
      this.setDeclutterHidden(false);
    }
    this._declutter = nextDeclutter;
    this._declutterPriority = material.declutterPriority ?? 0;

    this.visible = (material.show ?? true) && !!this._text;
    this._syncGlyphRefs();
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

    const nextOpacityRaw = material.opacity ?? 1.0;
    const nextOpacity = Number.isFinite(nextOpacityRaw)
      ? Math.max(0.0, Math.min(1.0, nextOpacityRaw))
      : 1.0;
    if (nextOpacity !== state.opacity) {
      baseProps.opacity = nextOpacity;
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
    if (nextOutlineWidth / sdfRadiusFor(state.useMsdf) !== state.outlineWidth) {
      baseProps.outlineWidth = nextOutlineWidth;
      hasUpdate = true;
    }

    const nextOutlineColor = material.outlineColor ?? 0x000000;
    if (nextOutlineColor !== state.outlineColor.getHex()) {
      baseProps.outlineColor = nextOutlineColor;
      hasUpdate = true;
    }

    const nextOutlineOpacityRaw = material.outlineOpacity ?? 1.0;
    const nextOutlineOpacity = Number.isFinite(nextOutlineOpacityRaw)
      ? Math.max(0.0, Math.min(1.0, nextOutlineOpacityRaw))
      : 1.0;
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

    if (material.transparent !== undefined) {
      const nextTransparent = material.transparent;
      if (nextTransparent !== state.transparent) {
        baseProps.transparent = nextTransparent;
        hasUpdate = true;
      }
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
    this._syncGlyphRefs();
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

  onBeforePicking(): void {
    this._enhancer.update({ base: { pickable: true } });
  }

  onAfterPicking(): void {
    this._enhancer.update({ base: { pickable: false } });
  }

  getRenderable(): Object3D {
    return this;
  }

  // --- Cleanup ---

  dispose(): void {
    // Release atlas glyph references so they can be evicted once unreferenced.
    if (this._retainedKeys) {
      this._fontManager.releaseGlyphs(
        this._fontUrl,
        this._highQuality,
        this._retainedKeys,
      );
      this._retainedKeys = null;
    }
    this.geometry?.dispose();
    if (!this._sharedAtlas) {
      this._atlasTexture?.dispose();
    }
    // Color atlas is always FontManager-owned; never disposed here.
    this.material?.dispose();
  }

  // --- Private ---

  private _createBaseGeometry(): InstancedBufferGeometry {
    const geo = new InstancedBufferGeometry();

    // Unit quad: 2 triangles, 6 vertices
    // prettier-ignore
    const positions = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]);
    // prettier-ignore
    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1,
      0, 0, 1, 1, 0, 1,
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
    /**
     * Per-instance flag: 1.0 → sample the COLRv1 color atlas, 0.0 → sample SDF.
     * Lets one batched mesh mix text and emoji from the same font family.
     */
    geo.setAttribute(
      "glyphIsColor",
      new InstancedBufferAttribute(new Float32Array(), 1),
    );

    geo.instanceCount = 0;

    return geo;
  }

  private _buildGlyphInstances(shapeResult: ShapeTextResult): void {
    const { glyphs, metrics, unitsPerEm, ascender, descender, lineGap } =
      shapeResult;

    // Build composite key -> metrics lookup.
    // Keys are pre-computed by the WASM font worker (composite_key in Rust)
    // to ensure the key layout is always in sync between Rust and TypeScript.
    const metricsMap = new Map<bigint, GlyphMetrics>();
    for (const m of metrics) {
      metricsMap.set(m.compositeKey, m);
    }

    const fontUnitToSdfPx = SDF_PX_SIZE / unitsPerEm;
    const fontUnitToColorPx = COLOR_GLYPH_PX_SIZE / unitsPerEm;

    // Baseline-to-baseline distance in font units. Older cached results may
    // predate line metrics; fall back to one em.
    const naturalLineHeight = ascender - descender + lineGap;
    const lineHeightFu =
      (naturalLineHeight > 0 ? naturalLineHeight : unitsPerEm) *
      this._lineHeight;

    // `_maxWidth` is in ems so the wrap width tracks the font size in both
    // sizeInMeters modes; font units are ems × unitsPerEm.
    const lines = breakLines(
      glyphs,
      this._maxWidth * unitsPerEm,
      isRtlText(this._text),
    );
    const widths = lines.map(lineWidthFu);
    const blockWidthFu = Math.max(...widths);

    const renderable: {
      offsetEmX: number;
      offsetEmY: number;
      sizeEmX: number;
      sizeEmY: number;
      uvL: number;
      uvT: number;
      uvR: number;
      uvB: number;
      isColor: boolean;
    }[] = [];

    // Unique atlas glyphs this mesh references — retained while it is visible.
    const glyphKeys = new Set<bigint>();

    // Lay lines out top-down: line 0 keeps its baseline at y=0 (identical to
    // the old single-line behavior), later baselines step down by the line
    // height. Alignment shifts each line within the widest line's width.
    // Each glyph carries its own normalization scale so SDF and color glyphs
    // share one em-space coordinate system downstream — the two paths may use
    // different raster sizes (SDF_PX_SIZE vs COLOR_GLYPH_PX_SIZE), but both
    // end up in [em]-units after dividing by their respective px.
    for (let li = 0; li < lines.length; li++) {
      let cursorX = (blockWidthFu - widths[li]) * this._textAlign;
      let cursorY = -li * lineHeightFu;

      for (const glyph of lines[li]) {
        const m = metricsMap.get(glyph.compositeKey);
        if (m && m.atlasW > 0 && m.atlasH > 0) {
          glyphKeys.add(glyph.compositeKey);
          const px = m.isColor ? COLOR_GLYPH_PX_SIZE : SDF_PX_SIZE;
          const fuToPx = m.isColor ? fontUnitToColorPx : fontUnitToSdfPx;
          const offsetPxX = (cursorX + glyph.xOffset) * fuToPx + m.bearingX;
          const offsetPxY = (cursorY + glyph.yOffset) * fuToPx + m.bearingY;

          // Atlas rects are stored in PIXEL space; the shader divides by the
          // current uSdfAtlasSize / uColorAtlasSize uniform to derive UVs, so
          // these instance attrs survive an atlas resize without rebuilding.
          renderable.push({
            offsetEmX: offsetPxX / px,
            offsetEmY: offsetPxY / px,
            sizeEmX: m.atlasW / px,
            sizeEmY: m.atlasH / px,
            uvL: m.atlasX,
            uvT: m.atlasY,
            uvR: m.atlasX + m.atlasW,
            uvB: m.atlasY + m.atlasH,
            isColor: m.isColor,
          });
        }
        cursorX += glyph.xAdvance;
        cursorY += glyph.yAdvance;
      }
    }

    // Update atlas references to this mesh's new glyph set (retains/releases
    // as needed based on visibility).
    this._setGlyphKeys([...glyphKeys]);

    const count = renderable.length;
    if (count === 0) {
      this.geometry.instanceCount = 0;
      this._labelWidthEm = 0;
      return;
    }

    // Text-width metric uses SDF scale; same em-space as the SDF path used to.
    // The block is as wide as its widest line and grows downward by one line
    // height per extra line (a single line stays exactly one em tall).
    const textWidth = blockWidthFu * fontUnitToSdfPx;
    const textHeight =
      SDF_PX_SIZE + (lines.length - 1) * lineHeightFu * fontUnitToSdfPx;

    const glyphOffsetData = new Float32Array((count + 1) * 2);
    const glyphSizeData = new Float32Array((count + 1) * 2);
    const glyphUvRectData = new Float32Array((count + 1) * 4);
    const glyphIsColorData = new Float32Array(count + 1);

    // Compute actual Y bounding box of all rendered glyphs
    let bgMinY = Infinity;
    let bgMaxY = -Infinity;

    // Index 0 is reserved for the background instance (drawn first).
    // Glyph data starts at index 1.
    for (let i = 0; i < count; i++) {
      const g = renderable[i];
      const j = i + 1; // offset by 1 to leave index 0 for background

      glyphOffsetData[j * 2] = g.offsetEmX;
      glyphOffsetData[j * 2 + 1] = g.offsetEmY;

      glyphSizeData[j * 2] = g.sizeEmX;
      glyphSizeData[j * 2 + 1] = g.sizeEmY;

      bgMinY = Math.min(bgMinY, g.offsetEmY);
      bgMaxY = Math.max(bgMaxY, g.offsetEmY + g.sizeEmY);

      glyphUvRectData[j * 4] = g.uvL;
      glyphUvRectData[j * 4 + 1] = g.uvT;
      glyphUvRectData[j * 4 + 2] = g.uvR;
      glyphUvRectData[j * 4 + 3] = g.uvB;

      glyphIsColorData[j] = g.isColor ? 1.0 : 0.0;
    }

    // Recreate geometry if instance count grew beyond the current capacity.
    if (this.geometry.instanceCount < count + 1) {
      this.geometry.dispose();
      this.geometry = this._createBaseGeometry();
    }

    this._setInstanceAttribute("glyphOffset", glyphOffsetData, 2);
    this._setInstanceAttribute("glyphSize", glyphSizeData, 2);
    this._setInstanceAttribute("glyphUvRect", glyphUvRectData, 4);
    this._setInstanceAttribute("glyphIsColor", glyphIsColorData, 1);

    this.geometry.instanceCount = count + 1;

    // Update text dimension uniforms via mutates, mirroring them CPU-side for
    // the declutter pass's collision box.
    this._labelWidthEm = textWidth / SDF_PX_SIZE;
    this._labelHeightEm = textHeight / SDF_PX_SIZE;
    this._labelMinYEm = bgMinY === Infinity ? 0.0 : bgMinY;
    this._labelMaxYEm = bgMaxY === -Infinity ? 1.0 : bgMaxY;
    this._enhancer
      .mutates()
      .updateTextDimensions(
        this._labelWidthEm,
        this._labelHeightEm,
        this._labelMinYEm,
        this._labelMaxYEm,
      );
  }

  private _setInstanceAttribute(
    name: string,
    data: Float32Array,
    itemSize: number,
  ): void {
    if (this.geometry.hasAttribute(name)) this.geometry.deleteAttribute(name);
    this.geometry.setAttribute(
      name,
      new InstancedBufferAttribute(data, itemSize),
    );
  }

  private _updateAtlasTexture(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
  ): void {
    if (this._atlasTexture) {
      // Update existing texture in-place (atlas dimensions are constant)
      this._atlasTexture.image = { data, width, height };
      this._atlasTexture.needsUpdate = true;
      return;
    }

    const tex = createSdfAtlasTexture(data, width, height, channels);
    this._atlasTexture = tex;
    this._enhancer.mutates().setAtlasTexture({ value: tex });
  }
}
