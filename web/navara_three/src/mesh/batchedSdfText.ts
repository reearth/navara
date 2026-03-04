import {
  type TextMesh as NavaraTextMesh,
  type TextMaterial as NavaraTextMaterial,
} from "@navara/engine";
import { Color } from "three";
import invariant from "tiny-invariant";

import { type BufferLoader } from "../event";
import type { FontManager } from "../font/FontManager";
import type { CommonUniforms } from "../uniforms";

import { InstancedMesh, type InstancedMeshOptions } from "./instanced";
import type { PickableMesh } from "./pickableMesh";
import { SDFTextMesh } from "./sdfText";

type PositionsInfo = {
  position:
    | Float32Array<ArrayBufferLike>
    | {
        high: Float32Array<ArrayBufferLike>;
        low: Float32Array<ArrayBufferLike>;
      };
  batchIDs: Float32Array<ArrayBufferLike> | null;
  positionSize: number;
  batchIDSize: number;
  nPositions: number;
  RTE: boolean;
};

export class BatchedSdfTextMesh
  extends InstancedMesh<SDFTextMesh>
  implements PickableMesh
{
  private _fontUrl: string;
  private _fontManager: FontManager;
  private _needRender?: () => void;

  constructor(
    m: NavaraTextMesh,
    buf: BufferLoader,
    fontManager: FontManager,
    fontUrl: string,
    _uniforms: CommonUniforms,
    options: InstancedMeshOptions,
  ) {
    super(options);
    this._fontUrl = fontUrl;
    this._fontManager = fontManager;
    this.initMeshes(m, buf, fontManager);
  }

  get fontUrl(): string {
    return this._fontUrl;
  }

  private initMeshes(
    m: NavaraTextMesh,
    buf: BufferLoader,
    fontManager: FontManager,
  ) {
    const positionInfo = this.extractPositions(m, buf);
    if (!positionInfo) {
      return;
    }

    const { position, nPositions, positionSize, batchIDs, batchIDSize, RTE } =
      positionInfo;

    const material = m.material;
    const transform = m.transform;
    const active = m.active;

    // Get the font-level shared atlas texture (one DataTexture per font, shared across all groups)
    const sharedTex = fontManager.getAtlasTexture(this._fontUrl);

    for (let i = 0; i < nPositions; i++) {
      const batchIdIdx = i * batchIDSize;
      const batchId = batchIDs ? batchIDs[batchIdIdx] : undefined;
      const posIdx = i * positionSize;
      const pos = RTE
        ? {
            high: (position as { high: Float32Array }).high.subarray(
              posIdx,
              posIdx + positionSize,
            ),
            low: (position as { low: Float32Array }).low.subarray(
              posIdx,
              posIdx + positionSize,
            ),
          }
        : (position as Float32Array).subarray(posIdx, posIdx + positionSize);

      const mesh = new SDFTextMesh(
        pos,
        material,
        transform,
        fontManager,
        this._fontUrl,
        batchId,
        RTE,
        active,
      );
      mesh.renderOrder = this.renderOrder;

      if (sharedTex) {
        mesh.setAtlasTexture(sharedTex);
      }

      mesh.update(material, active);

      this.addWithBatchIndex(mesh, i);
    }
  }

  _update(
    m: NavaraTextMesh,
    _buf: BufferLoader,
    active: boolean,
    needRender?: () => void,
  ) {
    if (needRender) this._needRender = needRender;

    const material = m.material;
    const text = material.text ?? "";

    // If the text hasn't been prepared in the worker yet, schedule async preparation
    if (text && !this._fontManager.isTextPrepared(this._fontUrl, text)) {
      this._fontManager.prepareText(this._fontUrl, text).then(() => {
        this._applyUpdate(material, active, needRender);
      });
      return;
    }

    this._applyUpdate(material, active, needRender);
  }

  private _applyUpdate(
    material: NavaraTextMaterial,
    active: boolean,
    needRender?: () => void,
  ) {
    // Update shared texture (in-place update if atlas grew)
    const sharedTex = this._fontManager.getAtlasTexture(this._fontUrl);
    if (sharedTex) {
      for (const mesh of this.meshes()) {
        mesh.setAtlasTexture(sharedTex);
      }
    }

    for (const mesh of this.meshes()) {
      mesh.update(material, active);
      this.markVisibility(mesh);
    }

    if (needRender) needRender();
  }

  override _setPickable(pickable: boolean) {
    for (const mesh of this.meshes()) {
      mesh._setPickable(pickable);
    }
  }

  private extractPositions(
    m: NavaraTextMesh,
    buf: BufferLoader,
  ): PositionsInfo | null {
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
      if (text && !this._fontManager.isTextPrepared(this._fontUrl, text)) {
        this._fontManager.prepareText(this._fontUrl, text).then(() => {
          // Refresh the shared atlas texture if the worker rasterized new glyphs
          const sharedTex = this._fontManager.getAtlasTexture(this._fontUrl);
          if (sharedTex) {
            mesh.setAtlasTexture(sharedTex);
          }
          mesh.setText(text);
          this.markVisibility(mesh);
          this._needRender?.();
        });
        return;
      }
      mesh.setText(text);
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
}
