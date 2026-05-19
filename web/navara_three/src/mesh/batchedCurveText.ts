import {
  type TextMesh as NavaraTextMesh,
  type TextMaterial as NavaraTextMaterial,
} from "@navara/engine";
import type { FontManager } from "@navara/font";
import { type Color } from "three";
import invariant from "tiny-invariant";

import type { EventContext } from "../event/context";

import { CurveTextMesh } from "./curveText";
import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import type { PickableMesh } from "./pickableMesh";

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
 * Container for Slug-style curve text meshes — one per feature batch index.
 *
 * Mirrors [BatchedSdfTextMesh] but drives the curve pipeline: text shaping
 * goes through `FontManager.prepareTextCurves` / `shapeTextCurves`, and the
 * shared GPU buffers come from `FontManager.getCurveTextures`.
 *
 * Phase 6 minimum surface area: feature color / show / height updates and
 * picking pass-through. Outline / background / batched material features
 * land in a follow-up alongside the curve enhancer.
 */
export class BatchedCurveTextMesh
  extends InstancedMesh<CurveTextMesh>
  implements PickableMesh
{
  readonly ctx: EventContext;
  private _fontIdentifier: string;
  private _fontManager: FontManager;
  private _needRender?: () => void;
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
    invariant(ctx.fontManager);
    this._fontManager = ctx.fontManager;
    this._loadedFaceUrls = loadedFaceUrls ?? new Set();
    this.initMeshes(m);
  }

  get fontIdentifier(): string {
    return this._fontIdentifier;
  }

  private initMeshes(m: NavaraTextMesh) {
    const info = this.extractPositions(m);
    if (!info) return;

    const { position, nPositions, positionSize, batchIDs, batchIDSize, RTE } =
      info;
    const material = m.material;
    const transform = m.transform;

    for (let i = 0; i < nPositions; i++) {
      const batchId = batchIDs ? batchIDs[i * batchIDSize] : undefined;
      const posIdx = i * positionSize;
      const pos = RTE
        ? {
            high: position.high.subarray(posIdx, posIdx + positionSize),
            low: position.low.subarray(posIdx, posIdx + positionSize),
          }
        : position.subarray(posIdx, posIdx + positionSize);

      const mesh = new CurveTextMesh(
        pos,
        material,
        transform,
        this._fontManager,
        this._fontIdentifier,
        batchId,
        RTE,
      );
      mesh.renderOrder = this.renderOrder;
      mesh.update(material);

      this.addWithBatchIndex(mesh, i);
    }
  }

  async _update(m: NavaraTextMesh, needRender?: () => void) {
    if (needRender) this._needRender = needRender;

    const material = m.material;
    const text = material.text ?? "";

    const info = this.extractPositions(m);
    if (info) {
      const { position, nPositions, positionSize, RTE } = info;
      invariant(
        nPositions === this.meshes().length,
        "Number of positions must match existing meshes",
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

    if (needFontUpdate) {
      if (this._loadedFaceUrls.size > 0) {
        await Promise.all(
          [...this._loadedFaceUrls].map((url) =>
            this._fontManager.unloadFont(url),
          ),
        );
        this._loadedFaceUrls.clear();
      } else if (!this._fontManager.isFamily(this._fontIdentifier)) {
        await this._fontManager.unloadFont(this._fontIdentifier);
      }
      if (!this._fontManager.isFamily(fontIdentifier)) {
        await this._fontManager.loadFont(fontIdentifier);
      }
    }
    this._fontIdentifier = fontIdentifier;

    if (
      (needFontUpdate || text) &&
      !this._fontManager.isTextCurvesPrepared(this._fontIdentifier, text)
    ) {
      this._fontManager
        .prepareTextCurves(this._fontIdentifier, text, this._loadedFaceUrls)
        .then(() => {
          this._applyUpdate(material, needRender, needFontUpdate);
        })
        .catch((err: unknown) => {
          console.error("Failed to prepare curve text:", err);
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
    for (const mesh of this.meshes()) {
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

  setTextByBatchIndex(batchIndex: number, text: string) {
    const mesh = this.meshes()[batchIndex];
    if (!mesh) return;
    if (
      text &&
      !this._fontManager.isTextCurvesPrepared(this._fontIdentifier, text)
    ) {
      // `CurveTextMesh` tracks intended visibility separately from
      // `_texturesBound`, so we no longer need to capture and restore
      // `mesh.visible` around the async prepare — `setText` will flip
      // visibility once textures land.
      this._fontManager
        .prepareTextCurves(this._fontIdentifier, text, this._loadedFaceUrls)
        .then(() => {
          mesh.setText(text);
          this.markVisibility(mesh);
          this._needRender?.();
        })
        .catch((err: unknown) => {
          console.error("Failed to prepare curve text:", err);
          this._needRender?.();
        });
      return;
    }
    mesh.setText(text);
    this.markVisibility(mesh);
    this._needRender?.();
  }

  setFeatureColorByBatchIndex(batchIndex: number, color: Color) {
    this.meshes()[batchIndex]?.setColor(color);
  }

  setFeatureShowByBatchIndex(batchIndex: number, rawVisible: boolean) {
    const mesh = this.meshes()[batchIndex];
    if (mesh) {
      mesh._setFeatureShow(rawVisible);
      this.markVisibility(mesh);
    }
  }

  setFeatureHeightByBatchIndex(batchIndex: number, height: number) {
    this.meshes()[batchIndex]?.setHeight(height);
  }

  dispose() {
    const unload =
      this._loadedFaceUrls.size > 0
        ? Promise.all(
            [...this._loadedFaceUrls].map((url) =>
              this._fontManager.unloadFont(url),
            ),
          )
        : this._fontManager.unloadFont(this._fontIdentifier);
    void unload.catch((err: unknown) => {
      console.error("Failed to unload font during dispose:", err);
    });
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
}
