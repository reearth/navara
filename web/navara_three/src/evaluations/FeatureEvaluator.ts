import { type FeatureId } from "@navara/core";
import type {
  ModelMaterial as NavaraModelMaterial,
  PointMaterial,
  PolygonMaterial,
  PolylineMaterial,
  TextMaterial,
} from "@navara/engine";
import { BufferGeometry, Mesh, Object3D } from "three";
import type { NormalBufferAttributes } from "three";
import invariant from "tiny-invariant";

import { Color } from "../Color";
import type { FeatureHandler } from "../event";
import {
  InstancedMesh,
  InstancedTextMesh,
  isFeatureMesh,
  ModelMesh,
  type ModelMaterial,
  BatchedFeatureMesh,
  type ModelBatchedAttributeName,
  type BatchedAttributeName,
} from "../mesh";
import type { ExtractProperties } from "../type";

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
  private cachedBatchedProperties?: Map<number, Map<string, unknown>>;
  private batchIds: number[] = [];

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
      (
        _batchIdx: number,
        _batchId: number,
        props: Map<string, unknown> | undefined,
      ) => {
        properties = props;
      },
    );

    return properties;
  }

  /**
   * Evaluate feature styles by feature's property.
   * Note that layer color is overridden by the evaluated color.
   */
  evaluate(
    f: (
      batchId: number,
      property: Map<string, unknown> | undefined,
    ) => Partial<EvaluatedValue>,
  ) {
    const result = new Map<
      EvaluatableMaterialPropertyKey,
      {
        itemSize: number;
        array: string[] | number[];
      }
    >();

    const prepare = (
      batchId: number,
      property: Map<string, unknown> | undefined,
    ) => {
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
    };

    if (this.cachedBatchedProperties) {
      for (const [batchIdx, property] of this.cachedBatchedProperties) {
        prepare(this.batchIds[batchIdx], property);
      }
    } else {
      this.cachedBatchedProperties = new Map();
      this.handler.readPropertiesFromFeature(
        this.featureId,
        (
          batchIdx: number,
          batchId: number,
          property: Map<string, unknown> | undefined,
        ) => {
          if (property) {
            this.cachedBatchedProperties?.set(batchIdx, property);
          }
          this.batchIds[batchIdx] = batchId;
          prepare(batchId, property);
        },
      );
    }

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

    this.result.length = 0;
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
                new Color().setRGBLinear(
                  target.array[colorIdx] as number,
                  target.array[colorIdx + 1] as number,
                  target.array[colorIdx + 2] as number,
                ).raw,
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
          case "height": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const height = target.array[i * target.itemSize] as number;
              m.setFeatureHeightByBatchIndex(i, height);
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
              new Color().setRGBLinear(
                target.array[0] as number,
                target.array[1] as number,
                target.array[2] as number,
              ).raw,
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
          case "height": {
            const height = target.array[0] as number;
            featureMesh._setFeatureHeight(height, m.material as ModelMaterial);
            continue;
          }
          // TODO: Support others
          default:
            continue;
        }
      }

      invariant(batchIdAttr);
      invariant(this.cachedBatchedProperties);

      const mesh =
        parent instanceof ModelMesh
          ? parent
          : m instanceof BatchedFeatureMesh
            ? m
            : undefined;
      invariant(mesh);

      const batchLength = this.batchIds.length;
      if (mesh instanceof ModelMesh) {
        mesh._initBatchDataTexture(
          m as Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
          batchLength,
        );
      } else {
        mesh?._initBatchDataTexture(batchLength);
      }

      const updateBatchAttribute = (
        batchIdx: number,
        attribute: ModelBatchedAttributeName | BatchedAttributeName,
        value: number | number[] | boolean,
      ) => {
        if (mesh instanceof ModelMesh) {
          mesh._updateBatchAttribute(
            m as Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
            batchIdx,
            attribute as ModelBatchedAttributeName,
            value,
          );
        } else {
          mesh._updateBatchAttribute(
            batchIdx,
            attribute as ModelBatchedAttributeName,
            value,
          );
        }
      };

      for (const [batchIdx, _property] of this.cachedBatchedProperties) {
        switch (target.attribute) {
          case "color": {
            const colorIdx = batchIdx * target.itemSize;
            const colorValues = [
              target.array[colorIdx] as number,
              target.array[colorIdx + 1] as number,
              target.array[colorIdx + 2] as number,
            ];
            updateBatchAttribute(batchIdx, "color", colorValues);
            break;
          }
          case "show": {
            const showIdx = batchIdx * target.itemSize;
            const visible = (target.array[showIdx] as number) >= 0.5;
            updateBatchAttribute(batchIdx, "show", visible);
            break;
          }
          case "height": {
            const heightIdx = batchIdx * target.itemSize;
            const height = target.array[heightIdx] as number;
            updateBatchAttribute(batchIdx, "height", height);
            break;
          }
          case "extrudedHeight": {
            const heightIdx = batchIdx * target.itemSize;
            const height = target.array[heightIdx] as number;
            updateBatchAttribute(batchIdx, "extrudedHeight", height);
            break;
          }
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
