import type {
  ModelMaterial as NavaraModelMaterial,
  PointMaterial,
  PolygonMaterial,
  PolylineMaterial,
  TextMaterial,
} from "navara_wasm";
import {
  BufferGeometry,
  Color,
  Mesh,
  Object3D,
  type NormalBufferAttributes,
} from "three";
import invariant from "tiny-invariant";

import type { FeatureHandler } from "../event";
import {
  InstancedMesh,
  InstancedTextMesh,
  isFeatureMesh,
  ModelMesh,
  type ModelMaterial,
} from "../mesh";
import { BatchedFeatureMesh } from "../mesh/batchedFeature";
import type { ExtractProperties } from "../type";
import type { FeatureId } from "../types";

type AvailableMaterialProperty = ExtractProperties<
  PointMaterial &
    PolylineMaterial &
    PolygonMaterial &
    NavaraModelMaterial &
    TextMaterial
>;

export type EvaluatableMaterialProperty = {
  color: AvailableMaterialProperty["color"];
  show: AvailableMaterialProperty["show"];
  extrudedHeight: AvailableMaterialProperty["extruded_height"];
  height: AvailableMaterialProperty["height"];
  text: AvailableMaterialProperty["text"];
};

type EvaluatableMaterialPropertyKey = keyof EvaluatableMaterialProperty;

type EvaluatedMaterialProperty = {
  color: Color;
  show: boolean;
  extrudedHeight: number;
  height: number;
  text: string;
};

export type EvaluatedValue = {
  [K in EvaluatableMaterialPropertyKey]: EvaluatedMaterialProperty[K];
};

type AggregatedResultValue<K = EvaluatableMaterialPropertyKey> = {
  attribute: K;
  itemSize: number;
  array: K extends "color"
    ? Float32Array
    : K extends "text"
      ? string[]
      : Uint32Array;
};

export class FeatureEvaluator {
  private handler: FeatureHandler;
  private featureId: FeatureId;

  // TODO: Need to support TSL
  obj: Object3D;

  private result: AggregatedResultValue[] = [];

  constructor(handler: FeatureHandler, featureId: FeatureId, obj: Object3D) {
    this.handler = handler;
    this.featureId = featureId;
    this.obj = obj;
  }

  get id() {
    return this.featureId;
  }

  // This works with non-batched feature like GeoJSON.
  readFeatureProperties() {
    let properties: Map<string, unknown> | undefined;

    this.handler.readPropertiesFromFeature(
      this.featureId,
      (_batchId: number, props: Map<string, unknown> | undefined) => {
        properties = props;
      },
    );

    return properties;
  }

  // This works with batched feature like MVT and Cesium 3D Tiles.
  evaluate(
    f: (
      batchId: number,
      v: Map<string, unknown> | undefined,
    ) => Partial<EvaluatedValue>,
  ) {
    const result = new Map<
      EvaluatableMaterialPropertyKey,
      {
        itemSize: number;
        array: string[] | number[];
      }
    >();

    this.handler.readPropertiesFromFeature(
      this.featureId,
      (batchId: number, property: Map<string, unknown> | undefined) => {
        const evaluatedValues = f(batchId, property);

        const keys = Object.keys(
          evaluatedValues,
        ) as (keyof typeof evaluatedValues)[];
        for (const key of keys) {
          let v = evaluatedValues[key];
          if (v == null) continue;

          if (typeof v === "boolean") {
            v = Number(v);
          }

          const array = getArray(v);
          if (!result.has(key)) {
            result.set(key, {
              itemSize: array.length,
              array: [],
            });
          }

          // Use a more specific type instead of any
          const resultArray = result.get(key)?.array as (string | number)[];
          // Ensure array only contains strings or numbers
          const typedArray = array as (string | number)[];
          resultArray.push(...typedArray);
        }
      },
    );

    // Convert just an array into TypedArray
    for (const [k, v] of result) {
      this.result.push({
        attribute: k,
        itemSize: v.itemSize,
        array:
          k === "text"
            ? (v.array as string[])
            : k === "color"
              ? new Float32Array(v.array as number[])
              : new Uint32Array(v.array as number[]),
      });
    }

    this.update();
  }

  private update() {
    if (this.obj instanceof InstancedMesh) {
      return this.apply(this.obj);
    }
    if (this.obj instanceof BatchedFeatureMesh) {
      return this.apply(this.obj);
    }
    if (this.obj instanceof ModelMesh) {
      const parent = this.obj;
      this.obj.traverse((m) => {
        if (!(m instanceof Mesh)) return;
        this.apply(m, parent);
      });
    }
  }

  private apply(
    m: Mesh | BatchedFeatureMesh | InstancedMesh<Object3D>,
    parent?: ModelMesh,
  ) {
    // FIXME(keiya01): Handle in web worker
    const batchIdAttr =
      "geometry" in m ? m.geometry.getAttribute("_batchid") : undefined;
    for (const target of this.result) {
      if (m instanceof InstancedMesh) {
        switch (target.attribute) {
          case "text": {
            if (!(m instanceof InstancedTextMesh)) continue;
            for (let i = 0; i < target.array.length; i++) {
              const v = target.array[i];

              m.setTextByNatchIndex(i, v as string);
            }
            continue;
          }
          case "color": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const colorIdx = i * target.itemSize;

              m.setFeatureColorByBatchIndex(
                i,
                new Color(
                  target.array[colorIdx] as number,
                  target.array[colorIdx + 1] as number,
                  target.array[colorIdx + 2] as number,
                ),
              );
            }
            continue;
          }
          case "show": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const visible =
                (target.array[i * target.itemSize] as number) >= 0.5;
              m.setFeatureShowByBatchIndex(i, visible);
            }
            continue;
          }
          default:
            continue;
        }
      }

      invariant("geometry" in m);

      if (!BatchedFeatureMesh._isBatchedAttributeName(target.attribute))
        continue;

      // Compat for non-batched mesh. For example, GeoJSON's polyline and polygon aren't batched for now.
      const featureMesh = (() => {
        if (batchIdAttr) return;
        if (parent) return isFeatureMesh(parent) ? parent : undefined;
        return isFeatureMesh(m) ? m : undefined;
      })();
      if (featureMesh) {
        switch (target.attribute) {
          case "color": {
            featureMesh._setFeatureColor(
              new Color(
                target.array[0] as number,
                target.array[1] as number,
                target.array[2] as number,
              ),
              m.material as ModelMaterial,
            );
            continue;
          }
          case "show": {
            const visible = (target.array[0] as number) >= 0.5;
            featureMesh._setFeatureShow(visible);
            continue;
          }
          case "extrudedHeight": {
            const height = target.array[0] as number;
            featureMesh._setFeatureExtrudedHeight(height);
            continue;
          }
          // TODO: Support others
          default:
            continue;
        }
      }

      invariant(batchIdAttr);

      // For batched meshes, get the appropriate attribute
      const targetAttr =
        m instanceof BatchedFeatureMesh
          ? m._getBatchedAttribute(target.attribute)
          : // For ModelMesh
            parent instanceof ModelMesh
            ? parent._getBatchedAttribute(
                target.attribute,
                m as Mesh<
                  BufferGeometry<NormalBufferAttributes>,
                  ModelMaterial
                >,
              )
            : m.geometry.getAttribute(target.attribute);

      if (!targetAttr) continue;

      const length = batchIdAttr.count / batchIdAttr.itemSize;
      for (let i = 0; i < length; i++) {
        const batchIdx = i * batchIdAttr.itemSize;
        const batchId = batchIdAttr.array[batchIdx] * target.itemSize;

        const attrIdx = i * targetAttr.itemSize;
        for (let i = 0; i < target.itemSize; i++) {
          const v = target.array[batchId + i];
          if (!(typeof v === "number")) continue;
          targetAttr.array[attrIdx + i] = v;
          targetAttr.needsUpdate = true;
        }
      }
    }
  }
}

function getArray(v: EvaluatedValue[keyof EvaluatedValue]) {
  if (v instanceof Color) {
    return v.toArray();
  }
  if (typeof v === "string") {
    return [v];
  }
  return [v];
}
