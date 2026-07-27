import type {
  TextMesh as NavaraTextMesh,
  TextMaterial as NavaraTextMaterial,
} from "@navaramap/engine";
import type { FontManager } from "@navaramap/font";
import { Color } from "three";
import invariant from "tiny-invariant";

import type {
  DeclutterCandidate,
  DeclutterParticipant,
} from "../declutter/types";
import type { EventContext } from "../event/context";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import type { PickableMesh } from "./pickableMesh";
import { SDFTextMesh } from "./sdfText";

type PositionsInfoBase = {
  batchIDs: Float32Array<ArrayBufferLike> | null;
  positionSize: number;
  batchIDSize: number;
  nPositions: number;
};

type PositionsInfo = PositionsInfoBase &
  (
    | {
        RTE: true;
        position: {
          high: Float32Array<ArrayBufferLike>;
          low: Float32Array<ArrayBufferLike>;
        };
      }
    | {
        RTE: false;
        position: Float32Array<ArrayBufferLike>;
      }
  );

/**
 * Per-feature evaluator state received before the feature's `SDFTextMesh`
 * exists (meshes are created lazily on the first non-empty text — see
 * `initMeshes`). Replayed onto the mesh at creation. Colors are kept as hex
 * so a shared evaluator `Color` instance mutated later can't leak in.
 */
type PendingFeatureState = {
  colorHex?: number;
  show?: boolean;
  height?: number;
  size?: number;
  opacity?: number;
  declutterPriority?: number | undefined;
  hasDeclutterPriority?: boolean;
};

export class BatchedSdfTextMesh
  extends InstancedMesh<SDFTextMesh>
  implements PickableMesh, DeclutterParticipant
{
  readonly ctx: EventContext;
  /** The font identifier from material — may be a family name or a URL. */
  private _fontIdentifier: string;
  /** Per-batch text quality. All instanced meshes in this batch share it
   *  because they all sample the same atlas texture; flipping quality requires
   *  a new BatchedSdfTextMesh. */
  private _highQuality: boolean;
  private _fontManager: FontManager;
  private _needRender?: () => void;
  /** Unsubscribe from the font manager's atlas-eviction notifications. */
  private _unsubscribeEvict?: () => void;
  /**
   * Face URLs loaded by this mesh for font-family fonts.
   * Each URL in this set has had loadFont() called exactly once by this mesh
   * and must be balanced with unloadFont() on dispose or font change.
   */
  private _loadedFaceUrls: Set<string>;
  /** Geometry-extracted anchor data; per-index meshes slice it lazily. */
  private _positions: PositionsInfo | null = null;
  /** Sparse batchIndex → mesh; `allMeshes` holds only created meshes. */
  private _meshByIndex: (SDFTextMesh | undefined)[] = [];
  /** Evaluator state received before a feature's mesh exists. */
  private _pending = new Map<number, PendingFeatureState>();
  /** Material/transform used when creating meshes lazily. */
  private _material: NavaraTextMaterial;
  private _transform: NavaraTextMesh["transform"];

  constructor(
    ctx: EventContext,
    m: NavaraTextMesh,
    fontIdentifier: string,
    options: InstancedMeshOptions,
    loadedFaceUrls?: Set<string>,
  ) {
    super(options);
    this.ctx = ctx;
    this._fontIdentifier = fontIdentifier;
    this._highQuality = m.material.highQuality ?? false;
    invariant(ctx.fontManager);
    this._fontManager = ctx.fontManager;
    this._loadedFaceUrls = loadedFaceUrls ?? new Set();
    // One getter call each: wasm getters clone, so these snapshots are owned
    // by this batch and safe to use after the event object is freed.
    this._material = m.material;
    this._transform = m.transform;
    this._positions = this.extractPositions(m);
    this.initMeshes();
    // When the shared atlas evicts glyphs, a still-in-flight glyph this batch
    // already baked into a visible mesh may have had its rect reused. Rebuild
    // any such stale mesh so its UVs and retains refresh.
    this._unsubscribeEvict = this._fontManager.onAtlasEvicted(
      this._fontIdentifier,
      this._highQuality,
      () => this._revalidateStaleMeshes(),
    );
    ctx.declutter?.register(this);
  }

  // --- DeclutterParticipant ---

  collectDeclutterCandidates(out: DeclutterCandidate[]): void {
    if (!this.visible) return;
    const meshes = this.meshes();
    for (let i = 0; i < meshes.length; i++) {
      const candidate = meshes[i].getDeclutterCandidate(this, i);
      if (candidate) out.push(candidate);
    }
  }

  applyDeclutter(handle: number, hidden: boolean): void {
    this.meshes()[handle]?.setDeclutterHidden(hidden);
  }

  stepDeclutterFade(deltaMs: number): boolean {
    let animating = false;
    for (const mesh of this.meshes()) {
      animating = mesh.stepDeclutterFade(deltaMs) || animating;
    }
    return animating;
  }

  /** Candidates changed (text, style, position, visibility): ask the shared
   *  declutter pass to re-place on its next update. */
  private _markDeclutterDirty(): void {
    this.ctx.declutter?.markDirty();
  }

  override setActive(active: boolean) {
    super.setActive(active);
    this._markDeclutterDirty();
  }

  /**
   * After an atlas eviction, re-prepare and force-rebuild any visible mesh whose
   * shaped text is now stale (its pinned glyphs may have been evicted before the
   * retain landed and its rect reused). Fresh meshes short-circuit on the cheap
   * `isTextPrepared` check, so this is inexpensive to run per eviction.
   */
  private _revalidateStaleMeshes(): void {
    const q = this._highQuality;
    for (const mesh of this.meshes()) {
      const text = mesh.text;
      if (!mesh.visible || !text) continue;
      if (this._fontManager.isTextPrepared(this._fontIdentifier, text, q)) {
        continue;
      }
      this._fontManager
        .prepareText(this._fontIdentifier, text, q, this._loadedFaceUrls)
        .then(() => {
          // Text may have changed (or the mesh hidden) while re-preparing.
          if (mesh.text !== text || !mesh.visible) return;
          const sharedTex = this._fontManager.getAtlasTexture(
            this._fontIdentifier,
            q,
          );
          if (sharedTex) mesh.setAtlasTexture(sharedTex);
          mesh.setColorAtlasTexture(
            this._fontManager.getColorAtlasTexture(this._fontIdentifier, q),
          );
          // Force a rebuild even though the text string is unchanged: the baked
          // atlas rects and glyph retains must refresh against the new metrics.
          mesh.setText(text, true);
          this._markDeclutterDirty();
          this._needRender?.();
        })
        .catch((err: unknown) => {
          console.error("Failed to revalidate text after eviction:", err);
        });
    }
  }

  get fontIdentifier(): string {
    return this._fontIdentifier;
  }

  get highQuality(): boolean {
    return this._highQuality;
  }

  /**
   * A mesh per anchor is expensive (geometry + ShaderMaterial + enhancer
   * mount), and with per-feature texts (MVT) most features never receive a
   * non-empty text — they'd sit invisible while still costing construction and
   * every per-frame loop. So meshes are created lazily by `_ensureMeshAt` on
   * the first non-empty `setTextByBatchIndex`. Only a non-empty material-level
   * default text (single-label sources) renders without the evaluator ever
   * setting text, so only that case creates all meshes eagerly.
   */
  private initMeshes() {
    const positionInfo = this._positions;
    if (!positionInfo) {
      return;
    }

    if (this._material.text) {
      // The atlas can't be reallocated within this synchronous loop, so fetch
      // the shared textures once and hand them to every creation.
      const shared = this._sharedTextures();
      for (let i = 0; i < positionInfo.nPositions; i++) {
        this._ensureMeshAt(i, shared);
      }
    }
  }

  /** The font-level shared atlas textures for this batch's font+quality (the
   *  color atlas is `null` for monochrome fonts). */
  private _sharedTextures() {
    return {
      tex: this._fontManager.getAtlasTexture(
        this._fontIdentifier,
        this._highQuality,
      ),
      colorTex: this._fontManager.getColorAtlasTexture(
        this._fontIdentifier,
        this._highQuality,
      ),
    };
  }

  /**
   * The feature's mesh, created on first need (see `initMeshes`). `shared`
   * lets a batch creation pass hoist the atlas lookups; when omitted (a single
   * lazy creation) they are fetched here, since the atlas may have been
   * (re)allocated since this batch was constructed.
   */
  private _ensureMeshAt(
    batchIndex: number,
    shared?: ReturnType<BatchedSdfTextMesh["_sharedTextures"]>,
  ): SDFTextMesh | undefined {
    const existing = this._meshByIndex[batchIndex];
    if (existing) return existing;

    const info = this._positions;
    if (!info || batchIndex < 0 || batchIndex >= info.nPositions) {
      return undefined;
    }

    const { position, positionSize, batchIDs, batchIDSize, RTE } = info;
    const batchId = batchIDs ? batchIDs[batchIndex * batchIDSize] : undefined;
    const posIdx = batchIndex * positionSize;
    const pos = RTE
      ? {
          high: position.high.subarray(posIdx, posIdx + positionSize),
          low: position.low.subarray(posIdx, posIdx + positionSize),
        }
      : position.subarray(posIdx, posIdx + positionSize);

    const mesh = new SDFTextMesh(
      pos,
      this._material,
      this._transform,
      this._fontManager,
      this._fontIdentifier,
      batchId,
      RTE,
    );
    mesh.renderOrder = this.renderOrder;
    // Re-prepare evicted glyphs through the batch so font-family faces and
    // refcounts stay consistent; request a render once they're rebuilt.
    mesh.setGlyphLifecycleHandlers(
      (text) =>
        this._fontManager.prepareText(
          this._fontIdentifier,
          text,
          this._highQuality,
          this._loadedFaceUrls,
        ),
      () => this._needRender?.(),
    );

    const { tex, colorTex } = shared ?? this._sharedTextures();
    if (tex) {
      mesh.setAtlasTexture(tex);
    }
    mesh.setColorAtlasTexture(colorTex);

    mesh.update(this._material);

    // Replay evaluator state that arrived before the mesh existed.
    const pending = this._pending.get(batchIndex);
    if (pending) {
      this._pending.delete(batchIndex);
      if (pending.colorHex !== undefined) {
        mesh.setColor(new Color(pending.colorHex));
      }
      if (pending.show !== undefined) {
        mesh._setFeatureShow(pending.show);
      }
      if (pending.height !== undefined) {
        mesh.setHeight(pending.height);
      }
      if (pending.size !== undefined) {
        mesh.setSize(pending.size);
      }
      if (pending.opacity !== undefined) {
        mesh.setOpacity(pending.opacity);
      }
      if (pending.hasDeclutterPriority) {
        mesh.setDeclutterPriority(pending.declutterPriority);
      }
    }

    this._meshByIndex[batchIndex] = mesh;
    this.addWithBatchIndex(mesh, batchIndex);
    return mesh;
  }

  /** Pending-state slot for a feature whose mesh doesn't exist yet. */
  private _pendingAt(batchIndex: number): PendingFeatureState | undefined {
    const info = this._positions;
    if (!info || batchIndex < 0 || batchIndex >= info.nPositions) {
      return undefined;
    }
    let state = this._pending.get(batchIndex);
    if (!state) {
      state = {};
      this._pending.set(batchIndex, state);
    }
    return state;
  }

  async _update(m: NavaraTextMesh, needRender?: () => void) {
    if (needRender) this._needRender = needRender;

    const material = m.material;
    const text = material.text ?? "";
    // Later lazy creations must see the updated material/transform too.
    this._material = material;
    this._transform = m.transform;

    const positionInfo = this.extractPositions(m);
    if (positionInfo) {
      invariant(
        this._positions === null ||
          positionInfo.nPositions === this._positions.nPositions,
        "Number of positions in the updated geometry must match the initial geometry",
      );
      this._positions = positionInfo;

      const { position, positionSize, RTE } = positionInfo;
      const transform = m.transform;
      for (const mesh of this.meshes()) {
        const posIdx = (mesh.userData.batchIndex as number) * positionSize;
        const pos = RTE
          ? {
              high: position.high.subarray(posIdx, posIdx + positionSize),
              low: position.low.subarray(posIdx, posIdx + positionSize),
            }
          : position.subarray(posIdx, posIdx + positionSize);
        mesh.setPosition(pos, RTE, transform);
      }
      // Anchors moved (e.g. terrain height resolution) — re-place labels.
      this._markDeclutterDirty();
    }

    // A non-empty default text renders without per-feature setText calls, so
    // any lazily-skipped meshes must exist before `_applyUpdate` (no-op for
    // already-created ones).
    if (text) this.initMeshes();

    const fontIdentifier = m.material.font ?? this._fontIdentifier;
    const needFontUpdate = fontIdentifier !== this._fontIdentifier;

    // Quality is immutable per batch (see _highQuality docs); use the batch's
    // quality everywhere, ignoring `m.material.highQuality` on updates.
    const q = this._highQuality;

    if (needFontUpdate) {
      // Unload old font resources.
      if (this._loadedFaceUrls.size > 0) {
        await Promise.all(
          [...this._loadedFaceUrls].map((url) =>
            this._fontManager.unloadFont(url, q),
          ),
        );
        this._loadedFaceUrls.clear();
      } else if (!this._fontManager.isFamily(this._fontIdentifier)) {
        await this._fontManager.unloadFont(this._fontIdentifier, q);
      }
      // For standalone new fonts load upfront; family faces are loaded lazily
      // by prepareText below.
      if (!this._fontManager.isFamily(fontIdentifier)) {
        await this._fontManager.loadFont(fontIdentifier, q);
      }
    }
    this._fontIdentifier = fontIdentifier;

    // If the text hasn't been prepared in the worker yet, schedule async preparation
    if (
      (needFontUpdate || text) &&
      !this._fontManager.isTextPrepared(this._fontIdentifier, text, q)
    ) {
      this._fontManager
        .prepareText(this._fontIdentifier, text, q, this._loadedFaceUrls)
        .then(() => {
          this._applyUpdate(material, needRender, needFontUpdate);
        })
        .catch((err: unknown) => {
          console.error("Failed to prepare text:", err);
          needRender?.();
        });
      return;
    }

    this._applyUpdate(material, needRender, needFontUpdate);
  }

  private _applyUpdate(
    material: NavaraTextMaterial,
    needRender?: () => void,
    forceUpdate = false,
  ) {
    // Update shared textures (in-place update if either atlas grew)
    const sharedTex = this._fontManager.getAtlasTexture(
      this._fontIdentifier,
      this._highQuality,
    );
    const sharedColorTex = this._fontManager.getColorAtlasTexture(
      this._fontIdentifier,
      this._highQuality,
    );

    for (const mesh of this.meshes()) {
      if (sharedTex) mesh.setAtlasTexture(sharedTex);
      mesh.setColorAtlasTexture(sharedColorTex);
      mesh.update(material, forceUpdate);
      this.markVisibility(mesh);
    }
    this._markDeclutterDirty();

    if (needRender) needRender();
  }

  override onBeforePicking() {
    for (const mesh of this.meshes()) {
      mesh.onBeforePicking();
    }
  }

  override onAfterPicking() {
    for (const mesh of this.meshes()) {
      mesh.onAfterPicking();
    }
  }

  private extractPositions(m: NavaraTextMesh): PositionsInfo | null {
    const { buf } = this.ctx;
    const g = m.geometry;

    const batchIdsData = g.batch_ids;
    const batchIDs = buf.removeF32(batchIdsData.data);
    const batchIDSize = batchIdsData.size;

    const positionData = g.position;
    const position = positionData
      ? buf.removeF32(positionData.data)
      : undefined;

    if (position && positionData) {
      const positionSize = positionData.size;
      const nPositions = position.length / positionSize;

      return {
        position,
        batchIDs,
        batchIDSize,
        positionSize,
        nPositions,
        RTE: false,
      };
    }

    const positionHighData = g.position_3d_high;
    const positionLowData = g.position_3d_low;
    const positionHigh = positionHighData
      ? buf.removeF32(positionHighData.data)
      : undefined;
    const positionLow = positionLowData
      ? buf.removeF32(positionLowData.data)
      : undefined;

    if (positionHigh && positionLow && positionHighData && positionLowData) {
      const positionLowSize = positionLowData.size;
      const positionHighSize = positionHighData.size;
      invariant(
        positionLowSize === positionHighSize,
        "Position high and low size mismatch",
      );

      const nPositions = positionHigh.length / positionHighSize;

      return {
        position: { high: positionHigh, low: positionLow },
        batchIDs,
        batchIDSize,
        positionSize: positionHighSize,
        nPositions,
        RTE: true,
      };
    }

    return null;
  }

  setTextByBatchIndex(batchIndex: number, text: string) {
    // An empty text on a not-yet-created mesh changes nothing (a lazily
    // skipped mesh is exactly an invisible empty-text label); only a
    // non-empty text forces the mesh into existence.
    const mesh = text
      ? this._ensureMeshAt(batchIndex)
      : this.getMeshByBatchIndex(batchIndex);

    if (mesh) {
      // If the text hasn't been prepared in the worker yet, schedule async preparation
      if (
        text &&
        !this._fontManager.isTextPrepared(
          this._fontIdentifier,
          text,
          this._highQuality,
        )
      ) {
        // Capture the intended visibility before the async font prep begins.
        // A concurrent processTextChanged → mesh.update(material) call may
        // reset mesh.visible to false (because this._text is still empty)
        // while the font is loading.
        const intendedVisible = mesh.visible;

        this._fontManager
          .prepareText(
            this._fontIdentifier,
            text,
            this._highQuality,
            this._loadedFaceUrls,
          )
          .then(() => {
            // Refresh shared atlas textures if the worker rasterized new glyphs
            const sharedTex = this._fontManager.getAtlasTexture(
              this._fontIdentifier,
              this._highQuality,
            );
            if (sharedTex) {
              mesh.setAtlasTexture(sharedTex);
            }
            mesh.setColorAtlasTexture(
              this._fontManager.getColorAtlasTexture(
                this._fontIdentifier,
                this._highQuality,
              ),
            );
            mesh.setText(text);
            // Restore intended visibility now that text content is available
            mesh.visible = intendedVisible;
            this.markVisibility(mesh);
            this._markDeclutterDirty();
            this._needRender?.();
          })
          .catch((err: unknown) => {
            console.error("Failed to prepare text:", err);
            this._needRender?.();
          });
        return;
      }
      mesh.setText(text);
      this.markVisibility(mesh);
      this._markDeclutterDirty();
      this._needRender?.();
    }
  }

  /**
   * The mesh for a feature's `batchIndex`, or `undefined` if not created yet.
   * Meshes are created lazily and pushed onto `allMeshes` in creation order, so
   * `allMeshes[batchIndex]` (the base-class mapping) does NOT hold here; the
   * batchIndex→mesh mapping lives in `_meshByIndex`. Overriding this one
   * accessor keeps the base-class setters and any external caller (picking,
   * plugins) correct without patching each call site.
   */
  override getMeshByBatchIndex(batchIndex: number): SDFTextMesh | undefined {
    return this._meshByIndex[batchIndex];
  }

  setFeatureColorByBatchIndex(batchIndex: number, color: Color) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh.setColor(color);
      return;
    }
    const pending = this._pendingAt(batchIndex);
    if (pending) pending.colorHex = color.getHex();
  }

  setFeatureShowByBatchIndex(batchIndex: number, rawVisible: boolean) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh._setFeatureShow(rawVisible);
      this.markVisibility(mesh);
      this._markDeclutterDirty();
      return;
    }
    // A lazily-created mesh starts hidden (empty text ⇒ `visible=false`), so a
    // mesh-less feature is already effectively `show:false`. Only `show:true`
    // needs buffering; buffering `show:false` would allocate a pending entry
    // per hidden feature — the common MVT case (most features stay hidden and
    // never get a mesh) and exactly the allocation lazy creation avoids. For
    // `show:false` just clear any stale buffered `show`, never allocate.
    if (rawVisible) {
      const pending = this._pendingAt(batchIndex);
      if (pending) pending.show = true;
    } else {
      const pending = this._pending.get(batchIndex);
      if (pending) pending.show = undefined;
    }
  }

  setFeatureHeightByBatchIndex(batchIndex: number, height: number) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh.setHeight(height);
      this._markDeclutterDirty();
      return;
    }
    const pending = this._pendingAt(batchIndex);
    if (pending) pending.height = height;
  }

  setFeatureSizeByBatchIndex(batchIndex: number, size: number) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh.setSize(size);
      this._markDeclutterDirty();
      return;
    }
    const pending = this._pendingAt(batchIndex);
    if (pending) pending.size = size;
  }

  setFeatureDeclutterPriorityByBatchIndex(
    batchIndex: number,
    priority: number,
  ) {
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh.setDeclutterPriority(priority);
      this._markDeclutterDirty();
      return;
    }
    const pending = this._pendingAt(batchIndex);
    if (pending) {
      pending.declutterPriority = priority;
      pending.hasDeclutterPriority = true;
    }
  }

  setFeatureOpacityByBatchIndex(batchIndex: number, opacity: number) {
    const clampedOpacity = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1.0;
    const mesh = this.getMeshByBatchIndex(batchIndex);
    if (mesh) {
      mesh.setOpacity(clampedOpacity);
      return;
    }
    const pending = this._pendingAt(batchIndex);
    if (pending) pending.opacity = clampedOpacity;
  }

  dispose() {
    this.ctx.declutter?.unregister(this);
    this._unsubscribeEvict?.();
    this._unsubscribeEvict = undefined;
    const q = this._highQuality;
    const unload =
      this._loadedFaceUrls.size > 0
        ? Promise.all(
            [...this._loadedFaceUrls].map((url) =>
              this._fontManager.unloadFont(url, q),
            ),
          )
        : this._fontManager.unloadFont(this._fontIdentifier, q);
    void unload.catch((err: unknown) => {
      console.error("Failed to unload font during dispose:", err);
    });
  }
}
