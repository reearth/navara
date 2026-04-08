import {
  type TextMesh as NavaraTextMesh,
  type TextMaterial as NavaraTextMaterial,
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
  private _fontManager: FontManager;
  private _needRender?: () => void;
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
    invariant(ctx.fontManager);
    this._fontManager = ctx.fontManager;
    this._loadedFaceUrls = loadedFaceUrls ?? new Set();
    this.initMeshes(m);
  }

  get fontIdentifier(): string {
    return this._fontIdentifier;
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

    // Get the font-level shared atlas texture (one DataTexture per font, shared across all groups)
    const sharedTex = this._fontManager.getAtlasTexture(this._fontIdentifier);

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

      if (sharedTex) {
        mesh.setAtlasTexture(sharedTex);
      }

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

    if (needFontUpdate) {
      // Unload old font resources.
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
      // For standalone new fonts load upfront; family faces are loaded lazily
      // by prepareText below.
      if (!this._fontManager.isFamily(fontIdentifier)) {
        await this._fontManager.loadFont(fontIdentifier);
      }
    }
    this._fontIdentifier = fontIdentifier;

    // If the text hasn't been prepared in the worker yet, schedule async preparation
    if (
      (needFontUpdate || text) &&
      !this._fontManager.isTextPrepared(this._fontIdentifier, text)
    ) {
      this._fontManager
        .prepareText(this._fontIdentifier, text, this._loadedFaceUrls)
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
    // Update shared texture (in-place update if atlas grew)
    const sharedTex = this._fontManager.getAtlasTexture(this._fontIdentifier);

    for (const mesh of this.meshes()) {
      if (sharedTex) mesh.setAtlasTexture(sharedTex);
      mesh.update(material, forceUpdate);
      this.markVisibility(mesh);
    }

    if (needRender) needRender();
  }

  override _setPickable(pickable: boolean) {
    for (const mesh of this.meshes()) {
      mesh._setPickable(pickable);
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
        !this._fontManager.isTextPrepared(this._fontIdentifier, text)
      ) {
        // Capture the intended visibility before the async font prep begins.
        // A concurrent processTextChanged → mesh.update(material) call may
        // reset mesh.visible to false (because this._text is still empty)
        // while the font is loading.
        const intendedVisible = mesh.visible;

        this._fontManager
          .prepareText(this._fontIdentifier, text, this._loadedFaceUrls)
          .then(() => {
            // Refresh the shared atlas texture if the worker rasterized new glyphs
            const sharedTex = this._fontManager.getAtlasTexture(
              this._fontIdentifier,
            );
            if (sharedTex) {
              mesh.setAtlasTexture(sharedTex);
            }
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
}
