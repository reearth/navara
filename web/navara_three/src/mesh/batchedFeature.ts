import { Unimplemented } from "@navara/core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Mesh,
  type Vector2,
  type NormalBufferAttributes,
} from "three";
import invariant from "tiny-invariant";

import type { CustomObject3DEventMap } from "../object3DEvent";

import {
  BATCHED_ATTRIBUTE_NAMES,
  getBatchDataTexture,
  initBatchDataTexture,
  initBatchedMaterial,
  updateBatchAttribute,
  type BatchedAttributeName,
  type BatchTextureConfig,
  type DefaultBatchAttributeValues,
} from "./batchTexture";
import type { FeatureMesh } from "./featureMesh";
import { PickableMesh } from "./pickableMesh";

export type BatchedFeatureAttributes<
  Attr extends NormalBufferAttributes = NormalBufferAttributes,
> = {
  _batchid?: BufferAttribute;
} & Attr;

export const FEATURE_BATCH_TEXTURE_CONFIG: BatchTextureConfig = {
  rows: ["COLOR_SHOW", "HEIGHT", "EXTRUDED_HEIGHT"],
  batchLength: 0,
};

export class BatchedFeatureMesh<
  Buf extends BufferGeometry<BatchedFeatureAttributes> =
    BufferGeometry<BatchedFeatureAttributes>,
  M extends Material = Material,
  E extends CustomObject3DEventMap = CustomObject3DEventMap,
>
  extends Mesh<Buf, M, E>
  implements FeatureMesh, PickableMesh
{
  batchLength?: number;
  static _isBatchedAttributeName(v: string): v is BatchedAttributeName {
    return BATCHED_ATTRIBUTE_NAMES.includes(v as BatchedAttributeName);
  }

  _setBatchIndex(
    batchIndex: Float32Array | null | undefined,
    size: number | null | undefined,
  ) {
    if (!batchIndex || !size) return;

    // Align to B3DM attribute: https://github.com/CesiumGS/3d-tiles/blob/492adb06b00870d9ee99b8d97c261a466783034c/specification/TileFormats/Batched3DModel/README.adoc#binary-gltf
    // TODO: However this need to be migrated to v1.1 in the future
    this.geometry.setAttribute(
      "_batchid",
      new BufferAttribute(batchIndex, size),
    );
  }

  _initBatchedMaterial() {
    initBatchedMaterial(this.material, FEATURE_BATCH_TEXTURE_CONFIG);
  }

  _initBatchDataTexture(): void {
    invariant(this.batchLength != null);

    const config: BatchTextureConfig = {
      ...FEATURE_BATCH_TEXTURE_CONFIG,
      batchLength: this.batchLength,
    };

    initBatchDataTexture(this.material, config);
  }

  _getBatchDataTexture() {
    return getBatchDataTexture(this.material);
  }

  _updateBatchAttribute(
    batchId: number,
    attribute: BatchedAttributeName,
    value: number | number[] | boolean,
  ): void {
    updateBatchAttribute(
      this.material,
      batchId,
      attribute,
      value,
      this._getDefaultBatchAttributeValues(),
    );

    this.needsUpdate();
  }

  needsUpdate() {
    this.dispatchEvent({ type: "needsUpdate" } as any); // Events aren't inferred well.
  }

  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    throw new Unimplemented();
  }

  _setFeatureColor(color: Color): void {
    this._updateBatchAttribute(0, "color", color.toArray());
  }

  _getFeatureColor(): Color {
    throw new Unimplemented();
  }

  _setFeatureShow(visible: boolean): void {
    this._updateBatchAttribute(0, "show", visible);
  }

  _setFeatureExtrudedHeight(height: number): void {
    this._updateBatchAttribute(0, "extrudedHeight", height);
  }

  _setFeatureHeight(height: number): void {
    this._updateBatchAttribute(0, "height", height);
  }

  _setFrustumCulled(_culled: boolean): void {
    throw new Unimplemented();
  }

  _setPickable(pickable: boolean, _pickingCoord?: Vector2) {
    this.material.userData.uPickable.value = pickable ? 1.0 : 0.0;
    this.needsUpdate();
  }

  clone() {
    return new BatchedFeatureMesh(this.geometry, this.material) as this;
  }
}
