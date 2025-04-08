import type {
  ModelMaterial as NavaraModelMaterial,
  PointMaterial,
  PolygonMaterial,
  PolylineMaterial,
  TextMaterial,
} from "navara_wasm";
import { Color, Mesh, Object3D, Sprite } from "three";
import invariant from "tiny-invariant";

import type { FeatureHandler } from "../event";
import {
  isFeatureMesh,
  ModelMesh,
  TextMesh,
  type ModelMaterial,
} from "../mesh";
import {
  BatchedFeatureMesh,
  type BatchedAttributeName,
} from "../mesh/batchedFeature";
import type { ExtractProperties } from "../type";
import type { FeatureId } from "../types";

export type EvaluatableMaterialProperty = keyof Pick<
  ExtractProperties<
    PointMaterial &
      PolylineMaterial &
      PolygonMaterial &
      NavaraModelMaterial &
      TextMaterial
  >,
  BatchedAttributeName | "text"
>;

export type EvaluatedValue = {
  [K in EvaluatableMaterialProperty]: K extends "color"
    ? Color
    : K extends "text"
      ? string
      : number;
};

type AggregatedResultValue<K = EvaluatableMaterialProperty> = {
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
      EvaluatableMaterialProperty,
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
          const v = evaluatedValues[key];
          if (!v) continue;

          const array = getArray(v);
          if (!result.has(key)) {
            result.set(key, {
              itemSize: array.length,
              array: [],
            });
          }

          (result.get(key)?.array as any[]).push(...array);
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
    if (this.obj instanceof TextMesh) {
      return this.apply(this.obj);
    }
    if (this.obj instanceof Sprite) {
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
    m: Mesh | BatchedFeatureMesh | TextMesh | Sprite,
    parent?: ModelMesh,
  ) {
    // FIXME(keiya01): Handle in web worker
    const batchIdAttr =
      "geometry" in m ? m.geometry.getAttribute("_batchid") : undefined;
    for (const target of this.result) {
      if (m instanceof TextMesh) {
        switch (target.attribute) {
          case "text": {
            // TODO: Support instancing
            const v = target.array[0];

            if (typeof v !== "string") continue;

            m.setText(v);
            continue;
          }
          case "color": {
            m.text?.material.color.set(
              target.array[0] as number,
              target.array[1] as number,
              target.array[2] as number,
            );
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
          // TODO: Support others
          default:
            continue;
        }
      }

      invariant(batchIdAttr);

      const targetAttr =
        m instanceof BatchedFeatureMesh
          ? m._getBatchedAttribute(target.attribute)
          : // For ModelMesh
            m.geometry.getAttribute(target.attribute);

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
