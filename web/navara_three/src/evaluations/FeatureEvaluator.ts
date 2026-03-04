import { type ExtractProperties, type FeatureId } from "@navara/core";
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
  InstancedSpriteMesh,
  BatchedSdfTextMesh,
} from "../mesh";

type AvailableMaterialProperty = ExtractProperties<
  PointMaterial &
    PolylineMaterial &
    PolygonMaterial &
    NavaraModelMaterial &
    TextMaterial
>;

/**
 * Material properties that can be evaluated and modified per-feature.
 */
export type EvaluatableMaterialProperty = {
  /** Feature color expression from layer configuration. */
  color: AvailableMaterialProperty["color"];
  /** Feature visibility expression from layer configuration. */
  show: AvailableMaterialProperty["show"];
  /** Extruded height expression from layer configuration (for polygons). */
  extrudedHeight: AvailableMaterialProperty["extrudedHeight"];
  /** Height expression from layer configuration. */
  height: AvailableMaterialProperty["height"];
  /** Text content expression from layer configuration (for text). */
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

/**
 * The evaluated values that can be returned from the evaluate callback.
 * All properties are optional - only return the ones you want to modify.
 */
export type EvaluatedValue = {
  /** The evaluated color for this feature. */
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

/**
 * Provides access to feature data and allows dynamic styling of features based on their properties.
 * Received through the `featureCreated` and `featureUpdated` events on a Layer.
 *
 * Use this class to:
 * - Read feature properties from the data source
 * - Dynamically style features based on their properties
 *
 * @example
 * ```typescript
 * // Style 3D Tiles buildings by height
 * layer.on("featureUpdated", (evaluator) => {
 *   evaluator.evaluate((_batchId, property) => {
 *     const measuredHeight = property?.["height"] as number;
 *
 *     // Color and visibility based on building height
 *     const color = (() => {
 *       if (measuredHeight < 30) return new Color().setStyle("#00ff00");
 *       if (measuredHeight < 60) return new Color().setStyle("#ffff00");
 *       if (measuredHeight < 90) return new Color().setStyle("#ff00ff");
 *       return new Color().setStyle("#ff0000");
 *     })();
 *
 *     return {
 *       color,
 *       show: measuredHeight >= 30, // Hide small buildings
 *     };
 *   });
 * });
 *
 * // Style GeoJSON polygons with extrusion based on properties
 * layer.on("featureUpdated", (evaluator) => {
 *   evaluator.evaluate((_batchId, property) => {
 *     const height = (property?.["height"] as number) ?? 0;
 *     const extrudedHeight = (property?.["extrudedHeight"] as number) ?? 0;
 *
 *     return {
 *       height,
 *       extrudedHeight,
 *     };
 *   });
 * });
 *
 * // Re-evaluate styles
 * const onChange = () => {
 *   layer.forceUpdate(); // Triggers featureUpdated events
 * };
 * ```
 */
export class FeatureEvaluator {
  private handler: FeatureHandler;
  private featureId: FeatureId;
  private cachedBatchedProperties?: Map<number, Record<string, unknown>>;
  private batchIds: number[] = [];

  /**
   * The underlying Three.js object representing this feature.
   * Can be used for advanced manipulation, but prefer using `evaluate()` for styling.
   */
  // TODO: Need to support TSL if we export it.
  private obj: Object3D;

  private result: AggregatedResultValue[] = [];

  constructor(handler: FeatureHandler, featureId: FeatureId, obj: Object3D) {
    this.handler = handler;
    this.featureId = featureId;
    this.obj = obj;
  }

  /**
   * Gets the unique identifier of this feature.
   */
  get id() {
    return this.featureId;
  }

  /**
   * Reads the properties of this feature from the data source.
   * The callback is invoked for each batch within this feature.
   *
   * @param f - Callback function that receives batchId and the property map for each batch
   *
   * @example
   * ```typescript
   * // Log all properties
   * evaluator.readFeatureProperties((batchId, properties) => {
   *   console.log(`Batch ${batchId}:`, properties);
   * });
   *
   * // Access nested JSON attributes (common in MVT/PLATEAU data)
   * evaluator.readFeatureProperties((_batchId, property) => {
   *   const attributes = JSON.parse((property?.["attributes"] as string) ?? "{}");
   *   const minHeight = attributes["minHeight"];
   *   const maxHeight = attributes["maxHeight"];
   * });
   * ```
   */
  readFeatureProperties(
    f: (batchId: number, property: Record<string, unknown> | undefined) => void,
  ) {
    if (this.cachedBatchedProperties) {
      for (const [batchIdx, property] of this.cachedBatchedProperties) {
        f(this.batchIds[batchIdx], property);
      }
    } else {
      this.cachedBatchedProperties = new Map();
      this.handler.readPropertiesFromFeature(
        this.featureId,
        (
          batchIdx: number,
          batchId: number,
          property: Record<string, unknown> | undefined,
        ) => {
          if (property) {
            this.cachedBatchedProperties?.set(batchIdx, property);
          }
          this.batchIds[batchIdx] = batchId;
          f(batchId, property);
        },
      );
    }
  }

  /**
   * Evaluates and applies dynamic styles to features based on their properties.
   * The callback is invoked for each batch (sub-feature) within this feature.
   *
   * Supported style properties:
   * - `color` - Feature color (use `new Color()`)
   * - `show` - Feature visibility (boolean)
   * - `height` - Feature height in meters
   * - `extrudedHeight` - Extrusion height for polygons in meters
   * - `text` - Label text content (for text/label features)
   *
   * Note: Evaluated styles override the layer's default styles.
   *
   * @param f - Callback function that receives batchId and properties, returns style values
   *
   * @example
   * ```typescript
   * // Color MVT features based on a category property
   * evaluator.evaluate((_batchId, property) => {
   *   const category = property?.["category"] as string;
   *
   *   const color = (() => {
   *     if (category === "A") return "#0000ff";
   *     if (category === "B") return "#00ff00";
   *     return "#ff0000";
   *   })();
   *
   *   return {
   *     color: new Color().setStyle(color),
   *   };
   * });
   *
   * // Filter and style text labels
   * evaluator.evaluate((_batchId, property) => {
   *   const text = property?.["name"] as string;
   *
   *   return {
   *     text,
   *     show: !!text,
   *   };
   * });
   * ```
   */
  evaluate(
    f: (
      batchId: number,
      property: Record<string, unknown> | undefined,
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
      property: Record<string, unknown> | undefined,
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

    this.readFeatureProperties(prepare);

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
    if (this.obj instanceof InstancedSpriteMesh) {
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
    m:
      | Mesh
      | BatchedFeatureMesh
      | InstancedMesh<Object3D>
      | InstancedSpriteMesh,
    parent?: ModelMesh,
  ) {
    // FIXME(keiya01): Handle in web worker
    const batchIdAttr =
      "geometry" in m ? m.geometry.getAttribute("_batchid") : undefined;
    for (const target of this.result) {
      if (m instanceof InstancedSpriteMesh) {
        switch (target.attribute) {
          case "color": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const colorIdx = i * target.itemSize;

              const color = new Color().setRGBLinear(
                target.array[colorIdx] as number,
                target.array[colorIdx + 1] as number,
                target.array[colorIdx + 2] as number,
              ).raw;

              m.setFeatureColorByBatchId(this.batchIds[i], color);
            }
            continue;
          }
          case "show": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const value = target.array[i * target.itemSize];
              const visible =
                value != null && typeof value === "number"
                  ? value >= 0.5
                  : undefined;
              m.setFeatureShowByBatchId(this.batchIds[i], visible ?? true);
            }
            continue;
          }
          case "height": {
            const len = target.array.length / target.itemSize;
            for (let i = 0; i < len; i++) {
              const height = target.array[i * target.itemSize] as number;
              m.setFeatureHeightByBatchId(this.batchIds[i], height);
            }
            continue;
          }
          default:
            continue;
        }
      }

      if (m instanceof InstancedMesh) {
        switch (target.attribute) {
          case "text": {
            if (
              !(m instanceof InstancedTextMesh) &&
              !(m instanceof BatchedSdfTextMesh)
            )
              continue;
            for (let i = 0; i < target.array.length; i++) {
              const v = target.array[i];

              m.setTextByBatchIndex(i, v as string);
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
              const value = target.array[i * target.itemSize];
              const visible =
                value != null && typeof value === "number"
                  ? value >= 0.5
                  : undefined;
              m.setFeatureShowByBatchIndex(i, visible ?? true);
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
            featureMesh._setFeatureHeight(height);
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
