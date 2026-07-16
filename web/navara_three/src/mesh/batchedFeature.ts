import { Unimplemented } from "@navara/core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Mesh,
  Object3D,
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
  type BatchTextureRowKey,
  type DefaultBatchAttributeValues,
} from "./batchTexture";
import type { FeatureMesh } from "./featureMesh";
import { PickableMesh } from "./pickableMesh";

export type BatchedFeatureAttributes<
  Attr extends NormalBufferAttributes = NormalBufferAttributes,
> = {
  _batchid?: BufferAttribute;
} & Attr;

/**
 * Batch texture rows per mesh type. A mesh's rows must only contain attributes
 * its shaders declare receiver variables for: `updateBatchAttribute` turns a
 * `USE_BATCH_*` define on whenever the row exists, and the shared
 * `batch_texture_vertex` chunk then assigns to the receiver — an undeclared one
 * (e.g. `addExtrudedHeight` in the polyline shaders) breaks shader compilation.
 */
export const POLYGON_BATCH_TEXTURE_ROWS: BatchTextureRowKey[] = [
  "COLOR_SHOW",
  "HEIGHT",
  "EXTRUDED_HEIGHT",
];

export const POLYLINE_BATCH_TEXTURE_ROWS: BatchTextureRowKey[] = [
  "COLOR_SHOW",
  "HEIGHT",
  "LINE_WIDTH",
];

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

  /**
   * Batch texture rows supported by this mesh type's shaders. Attributes
   * without a row are silently ignored by `updateBatchAttribute`.
   */
  _getBatchTextureRows(): BatchTextureRowKey[] {
    throw new Unimplemented();
  }

  _initBatchedMaterial() {
    initBatchedMaterial(this.material, {
      rows: this._getBatchTextureRows(),
      batchLength: 0,
    });
  }

  _initBatchDataTexture(): void {
    invariant(this.batchLength != null);

    const config: BatchTextureConfig = {
      rows: this._getBatchTextureRows(),
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

  _setFeatureWidth(width: number): void {
    this._updateBatchAttribute(0, "lineWidth", width);
  }

  _setFeatureOpacity(opacity: number): void {
    this._updateBatchAttribute(0, "opacity", opacity);
  }

  _setFrustumCulled(_culled: boolean): void {
    throw new Unimplemented();
  }

  onBeforePicking(_pickingCoord?: Vector2) {
    this.material.userData.uPickable.value = 1.0;
    this.needsUpdate();
  }

  onAfterPicking() {
    this.material.userData.uPickable.value = 0.0;
    this.needsUpdate();
  }

  getRenderable(): Object3D {
    return this;
  }

  clone() {
    return new BatchedFeatureMesh(this.geometry, this.material) as this;
  }
}
