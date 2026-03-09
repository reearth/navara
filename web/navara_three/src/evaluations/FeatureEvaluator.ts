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

/**
 * Information about a feature batch, passed to evaluation callbacks.
 */
export type FeatureInfo = {
  batchIndex: number;
  batchId: number;
  properties: Record<string, unknown> | undefined;
};

/**
 * Callback function type for feature evaluator operations.
 */
export type FeatureEvaluatorCallback = (
  info: FeatureInfo,
) => Partial<EvaluatedValue>;

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
 *   evaluator.evaluate(({ properties }) => {
 *     const measuredHeight = properties?.["height"] as number;
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
 *   evaluator.evaluate(({ properties }) => {
 *     const height = (properties?.["height"] as number) ?? 0;
 *     const extrudedHeight = (properties?.["extrudedHeight"] as number) ?? 0;
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
  private cachedBatchedProperties?: Map<
    number,
    Record<string, unknown> | undefined
  >;
  private filterCacheKey?: string;
  private cachedFilteredProperties?: Map<
    number,
    Record<string, unknown> | undefined
  >;
  private batchIds: number[] = [];

  /**
   * The underlying Three.js object representing this feature.
   * Can be used for advanced manipulation, but prefer using `evaluate()` for styling.
   */
  // TODO: Need to support TSL if we export it.
  private obj: Object3D;

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
   * @param f - Callback function that receives feature info for each batch
   *
   * @example
   * ```typescript
   * // Log all properties
   * evaluator.readFeatureProperties(({ batchId, properties }) => {
   *   console.log(`Batch ${batchId}:`, properties);
   * });
   *
   * // Access nested JSON attributes (common in MVT/PLATEAU data)
   * evaluator.readFeatureProperties(({ properties }) => {
   *   const attributes = JSON.parse((properties?.["attributes"] as string) ?? "{}");
   *   const minHeight = attributes["minHeight"];
   *   const maxHeight = attributes["maxHeight"];
   * });
   * ```
   */
  readFeatureProperties(f: (info: FeatureInfo) => void) {
    if (this.cachedBatchedProperties) {
      for (const [batchIdx, properties] of this.cachedBatchedProperties) {
        f({
          batchIndex: batchIdx,
          batchId: this.batchIds[batchIdx],
          properties,
        });
      }
    } else {
      this.cachedBatchedProperties = new Map();
      this.handler.readAllBatchedProperties(
        this.featureId,
        (
          batchIdx: number,
          batchId: number,
          properties: Record<string, unknown> | undefined,
        ) => {
          this.cachedBatchedProperties?.set(batchIdx, properties);
          this.batchIds[batchIdx] = batchId;
          f({ batchIndex: batchIdx, batchId, properties });
        },
      );
    }
  }

  /**
   * Reads only the specified root properties of this feature.
   * This is more efficient than `readFeatureProperties` when only a few properties are needed.
   *
   * @param keys - Array of property key names to read
   * @param f - Callback function that receives feature info for each batch
   *
   * @example
   * ```typescript
   * evaluator.readFilteredFeatureProperties(["height", "name"], ({ batchId, properties }) => {
   *   const { height, name } = properties;
   * });
   * ```
   */
  readFilteredFeatureProperties(
    keys: string[],
    f: (info: FeatureInfo) => void,
  ) {
    const cacheKey = keys.join("|");
    if (this.filterCacheKey === cacheKey && this.cachedFilteredProperties) {
      for (const [batchIndex, filtered] of this.cachedFilteredProperties) {
        f({
          batchIndex,
          batchId: this.batchIds[batchIndex],
          properties: filtered,
        });
      }
    } else {
      this.cachedFilteredProperties = new Map();
      this.filterCacheKey = cacheKey;

      this.handler.readFilteredBatchedProperties(
        this.featureId,
        keys,
        (batchIndex: number, batchId: number, filtered?: unknown[]) => {
          const properties: Record<string, unknown> = {};
          for (let i = 0; i < keys.length; i++) {
            properties[keys[i]] = filtered?.[i];
          }
          this.cachedFilteredProperties?.set(batchIndex, properties);
          this.batchIds[batchIndex] = batchId;
          f({ batchIndex, batchId, properties });
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
   * @param f Callback function that receives feature info, returns style values
   * @param options.filters - Root property's keys that get only the matched property values.
   *
   * @example
   * ```typescript
   * // Color MVT features based on a category property
   * evaluator.evaluate(({ properties }) => {
   *   const category = properties?.["category"] as string;
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
   * evaluator.evaluate(({ properties }) => {
   *   const text = properties?.["name"] as string;
   *
   *   return {
   *     text,
   *     show: !!text,
   *   };
   * });
   * ```
   */
  evaluate(
    f: FeatureEvaluatorCallback,
    options?: {
      filters?: string[];
    },
  ) {
    const evaluate = (info: FeatureInfo) => {
      const evaluated = f(info);
      this.applyEvaluatedValues(info.batchIndex, info.batchId, evaluated);
    };

    if (options?.filters) {
      this.readFilteredFeatureProperties(options.filters, evaluate);
    } else {
      this.readFeatureProperties(evaluate);
    }
  }

  private applyEvaluatedValues(
    batchIndex: number,
    batchId: number,
    evaluated: Partial<EvaluatedValue>,
  ) {
    const obj = this.obj;

    if (obj instanceof InstancedSpriteMesh) {
      if (evaluated.color != null) {
        obj.setFeatureColorByBatchId(batchId, evaluated.color.raw);
      }
      if (evaluated.show != null) {
        obj.setFeatureShowByBatchId(batchId, evaluated.show);
      }
      if (evaluated.height != null) {
        obj.setFeatureHeightByBatchId(batchId, evaluated.height);
      }
      return;
    }

    if (obj instanceof InstancedMesh) {
      if (evaluated.color != null) {
        obj.setFeatureColorByBatchIndex(batchIndex, evaluated.color.raw);
      }
      if (evaluated.show != null) {
        obj.setFeatureShowByBatchIndex(batchIndex, evaluated.show);
      }
      if (evaluated.height != null) {
        obj.setFeatureHeightByBatchIndex(batchIndex, evaluated.height);
      }
      if (evaluated.text != null && obj instanceof InstancedTextMesh) {
        obj.setTextByBatchIndex(batchIndex, evaluated.text);
      }
      return;
    }

    if (obj instanceof BatchedFeatureMesh) {
      obj._initBatchDataTexture();
      this.apply(obj, undefined, batchIndex, evaluated);
      return;
    }

    if (obj instanceof ModelMesh) {
      obj.traverse((m) => {
        if (!(m instanceof Mesh)) return;
        obj._initBatchDataTexture(m);
        this.apply(m, obj, batchIndex, evaluated);
      });
    }
  }

  private apply(
    m: Mesh | BatchedFeatureMesh,
    parent: ModelMesh | undefined,
    batchIndex: number,
    evaluated: Partial<EvaluatedValue>,
  ) {
    const batchIdAttr =
      "geometry" in m ? m.geometry.getAttribute("_batchid") : undefined;

    // Non-batched feature mesh path (e.g. GeoJSON polyline/polygon)
    const featureMesh = (() => {
      if (batchIdAttr) return;
      if (parent) return isFeatureMesh(parent) ? parent : undefined;
      return isFeatureMesh(m) ? m : undefined;
    })();

    if (featureMesh) {
      if (evaluated.color != null) {
        featureMesh._setFeatureColor(
          evaluated.color.raw,
          m.material as ModelMaterial,
        );
      }
      if (evaluated.show != null) {
        featureMesh._setFeatureShow(evaluated.show);
      }
      if (evaluated.extrudedHeight != null) {
        featureMesh._setFeatureExtrudedHeight(evaluated.extrudedHeight);
      }
      if (evaluated.height != null) {
        featureMesh._setFeatureHeight(evaluated.height);
      }
      return;
    }

    // Batched mesh path
    if (!batchIdAttr) return;

    const mesh =
      parent instanceof ModelMesh
        ? parent
        : m instanceof BatchedFeatureMesh
          ? m
          : undefined;
    if (!mesh) return;

    const updateBatchAttribute = (
      attribute: ModelBatchedAttributeName | BatchedAttributeName,
      value: number | number[] | boolean,
    ) => {
      if (mesh instanceof ModelMesh) {
        mesh._updateBatchAttribute(
          m as Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
          batchIndex,
          attribute as ModelBatchedAttributeName,
          value,
        );
      } else {
        mesh._updateBatchAttribute(
          batchIndex,
          attribute as BatchedAttributeName,
          value,
        );
      }
    };

    if (evaluated.color != null) {
      updateBatchAttribute("color", evaluated.color.toArray());
    }
    if (evaluated.show != null) {
      updateBatchAttribute("show", evaluated.show);
    }
    if (evaluated.height != null) {
      updateBatchAttribute("height", evaluated.height);
    }
    if (evaluated.extrudedHeight != null) {
      updateBatchAttribute("extrudedHeight", evaluated.extrudedHeight);
    }
  }
}
