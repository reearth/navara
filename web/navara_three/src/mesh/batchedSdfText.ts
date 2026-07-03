import type {
  TextMesh as NavaraTextMesh,
  TextMaterial as NavaraTextMaterial,
} from "@navara/engine";
import type { FontManager } from "@navara/font";
import { type Color } from "three";
import invariant from "tiny-invariant";

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

export class BatchedSdfTextMesh
  extends InstancedMesh<SDFTextMesh>
  implements PickableMesh
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
    this.initMeshes(m);
    // When the shared atlas evicts glyphs, a still-in-flight glyph this batch
    // already baked into a visible mesh may have had its rect reused. Rebuild
    // any such stale mesh so its UVs and retains refresh.
    this._unsubscribeEvict = this._fontManager.onAtlasEvicted(
      this._fontIdentifier,
      this._highQuality,
      () => this._revalidateStaleMeshes(),
    );
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

  private initMeshes(m: NavaraTextMesh) {
    const positionInfo = this.extractPositions(m);
    if (!positionInfo) {
      return;
    }

    const { position, nPositions, positionSize, batchIDs, batchIDSize, RTE } =
      positionInfo;

    const material = m.material;
    const transform = m.transform;

    // Get the font-level shared atlas textures (one DataTexture per font,
    // shared across all per-feature meshes). The color atlas is `null` for
    // monochrome fonts.
    const sharedTex = this._fontManager.getAtlasTexture(
      this._fontIdentifier,
      this._highQuality,
    );
    const sharedColorTex = this._fontManager.getColorAtlasTexture(
      this._fontIdentifier,
      this._highQuality,
    );

    for (let i = 0; i < nPositions; i++) {
      const batchIdIdx = i * batchIDSize;
      const batchId = batchIDs ? batchIDs[batchIdIdx] : undefined;
      const posIdx = i * positionSize;
      const pos = RTE
        ? {
            high: position.high.subarray(posIdx, posIdx + positionSize),
            low: position.low.subarray(posIdx, posIdx + positionSize),
          }
        : position.subarray(posIdx, posIdx + positionSize);

      const mesh = new SDFTextMesh(
        pos,
        material,
        transform,
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

      if (sharedTex) {
        mesh.setAtlasTexture(sharedTex);
      }
      mesh.setColorAtlasTexture(sharedColorTex);

      mesh.update(material);

      this.addWithBatchIndex(mesh, i);
    }
  }

  async _update(m: NavaraTextMesh, needRender?: () => void) {
    if (needRender) this._needRender = needRender;

    const material = m.material;
    const text = material.text ?? "";

    const positionInfo = this.extractPositions(m);
    if (positionInfo) {
      const { position, nPositions, positionSize, RTE } = positionInfo;

      invariant(
        nPositions === this.meshes().length,
        "Number of positions in the updated geometry must match the number of existing meshes",
      );

      const transform = m.transform;
      for (let i = 0; i < nPositions; i++) {
        const posIdx = i * positionSize;
        const pos = RTE
          ? {
              high: position.high.subarray(posIdx, posIdx + positionSize),
              low: position.low.subarray(posIdx, posIdx + positionSize),
            }
          : position.subarray(posIdx, posIdx + positionSize);
        this.meshes()[i].setPosition(pos, RTE, transform);
      }
    }

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
    const mesh = this.meshes()[batchIndex];

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
      this._needRender?.();
    }
  }

  setFeatureColorByBatchIndex(batchIndex: number, color: Color) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh.setColor(color);
    }
  }

  setFeatureShowByBatchIndex(batchIndex: number, rawVisible: boolean) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh._setFeatureShow(rawVisible);
      this.markVisibility(mesh);
    }
  }

  setFeatureHeightByBatchIndex(batchIndex: number, height: number) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh.setHeight(height);
    }
  }

  setFeatureSizeByBatchIndex(batchIndex: number, size: number) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh.setSize(size);
    }
  }

  setFeatureOpacityByBatchIndex(batchIndex: number, opacity: number) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh.setOpacity(opacity);
    }
  }

  dispose() {
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
