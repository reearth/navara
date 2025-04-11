import { Unimplemented } from "@navara/core";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Mesh,
  type NormalBufferAttributes,
} from "three";

import type { FeatureMesh } from "./featureMesh";

export type BatchedFeatureAttributes<
  Attr extends NormalBufferAttributes = NormalBufferAttributes,
> = {
  _batchid?: BufferAttribute;
  color?: BufferAttribute;
} & Attr;

const BATCHED_ATTRIBUTE_NAMES = [
  "color",
  "show",
  "height",
  "extruded_height",
] as const;

export type BatchedAttributeName = (typeof BATCHED_ATTRIBUTE_NAMES)[number];

export class BatchedFeatureMesh<
    Buf extends
      BufferGeometry<BatchedFeatureAttributes> = BufferGeometry<BatchedFeatureAttributes>,
    M extends Material = Material,
  >
  extends Mesh<Buf, M>
  implements FeatureMesh
{
  static _isBatchedAttributeName(v: string): v is BatchedAttributeName {
    return BATCHED_ATTRIBUTE_NAMES.includes(v as BatchedAttributeName);
  }

  _setBatchIndex(
    batchIndex: Uint32Array | null | undefined,
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

  _getBatchedAttribute(
    targetAttr: BatchedAttributeName,
  ): BufferAttribute | undefined {
    switch (targetAttr) {
      case "color":
        return this._batchedVertexColor;
      case "show":
        throw new Unimplemented();
      case "height":
        throw new Unimplemented();
      case "extruded_height":
        throw new Unimplemented();
    }
  }

  get _batchedVertexColor() {
    const verCount = this.geometry.attributes._batchid?.array?.length ?? 0;
    if (!verCount) return;

    if (this.material.vertexColors) {
      return this.geometry.attributes.color;
    } else {
      this.material.vertexColors = true;
      this.geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(verCount * 3), 3),
      );
      return this.geometry.attributes.color;
    }
  }

  // Compat for non-batched mesh. For example, GeoJSON's polyline and polygon aren't batched for now.
  _setFeatureColor(_color: Color) {
    throw new Unimplemented();
  }

  _getFeatureColor(): Color {
    throw new Unimplemented();
  }

  _setFrustumCulled(_culled: boolean): void {
    throw new Unimplemented();
  }
}
