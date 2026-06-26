/**
 * JavaScript implementation of StyleEngine using @maplibre/maplibre-gl-style-spec.
 *
 */

import {
  createExpression,
  featureFilter,
  validateStyleMin,
  v8,
} from "@maplibre/maplibre-gl-style-spec";
import type { StyleEngine } from "./StyleEngine";
import type {
  EvaluationContext,
  FeatureContext,
  FilterExpression,
  LayerType,
  ParsedStyle,
  PropertySpec,
  StyleValue,
  ValueExpression,
} from "./types";

/**
 * MapLibre's official paint property specifications by layer type.
 * Using the official specs ensures compatibility with the MapLibre Style spec.
 */
const PAINT_SPECS_BY_TYPE = {
  fill: v8.paint_fill,
  line: v8.paint_line,
  circle: v8.paint_circle,
};

export class JsStyleEngine implements StyleEngine {
  async parseStyle(raw: unknown): Promise<ParsedStyle> {
    const errors = validateStyleMin(raw as any);

    if (errors && errors.length > 0) {
      const errorMessages = errors.map((e: { message: string }) => e.message);
      const error = new Error(
        `Invalid MapLibre Style: ${errorMessages.join(", ")}`,
      );

      throw error;
    }

    return raw as ParsedStyle;
  }

  createFilter(
    expr: FilterExpression,
    _layerType: LayerType,
    geometryType: string,
  ): (feature: FeatureContext) => boolean {
    const { filter } = featureFilter(expr);

    return (ctx: FeatureContext) => {
      const feature = {
        type: "Feature" as const,
        properties: ctx.properties ?? {},
        geometry: {
          type: geometryType as any,
          coordinates: [], // Empty - we don't care about actual geometry coordinates for filtering
        },
      };

      // zoom is required for filter evaluation, but we don't have zoom info in Navara yet,
      // so we just pass 0 for now. In the future, we can pass actual zoom from camera.
      return filter({ zoom: 0 }, feature as any);
    };
  }

  createValueFn<T extends StyleValue>(
    expr: ValueExpression,
    spec: PropertySpec,
    geometryType = "Point",
  ): (ctx: EvaluationContext) => T {
    // Create expression using maplibre-gl-style-spec
    const result = createExpression(expr, spec as any);

    if (result.result === "error") {
      const errorMsg = result.value
        .map((e: { message: string }) => e.message)
        .join(", ");
      throw new Error(`Failed to create expression: ${errorMsg}`);
    }

    const expression = result.value;

    return (ctx: EvaluationContext) => {
      // Create a minimal GeoJSON feature object for evaluation
      // We don't have actual geometry coordinates, but most expressions only need the type
      const feature = {
        type: "Feature" as const,
        properties: ctx.properties ?? {},
        geometry: {
          type: geometryType as any,
          coordinates: [], // Empty - we don't care about actual geometry coordinates for evaluation
        },
      };

      // zoom is required for filter evaluation, but we don't have zoom info in Navara yet,
      // so we just pass 0 for now. In the future, we can pass actual zoom from camera.
      const value = expression.evaluate({ zoom: 0 }, feature as any);

      return value as T;
    };
  }

  getPaintSpec(
    layerType: LayerType,
    propertyName: string,
  ): PropertySpec | undefined {
    const paintSpecs = PAINT_SPECS_BY_TYPE[layerType];
    if (!paintSpecs) {
      return undefined;
    }

    const spec = paintSpecs[propertyName as keyof typeof paintSpecs];
    return spec as PropertySpec | undefined;
  }
}
