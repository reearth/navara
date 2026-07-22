/**
 * JavaScript implementation of StyleEngine using @maplibre/maplibre-gl-style-spec.
 *
 */

import {
  createExpression,
  featureFilter,
  validateStyleMin,
} from "@maplibre/maplibre-gl-style-spec";
import type {
  FilterSpecification,
  StyleSpecification,
  StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";

import { PAINT_SPECS_BY_TYPE } from "./paintSpecs";
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

export class JsStyleEngine implements StyleEngine {
  async parseStyle(raw: unknown): Promise<ParsedStyle> {
    const errors = validateStyleMin(raw as StyleSpecification);

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
    // Since v21 `featureFilter` requires a `rootKey` locating the expression in
    // the style JSON; it is only used to prefix runtime warnings.
    const { filter } = featureFilter(expr as FilterSpecification, "filter");

    return (ctx: FeatureContext) => {
      // Construct a valid GeoJSON Feature for MapLibre's filter evaluator.
      // This ensures filters like ["geometry-type"] work correctly.
      const feature = {
        type: "Feature" as const,
        properties: ctx.properties ?? {},
        geometry: {
          type: geometryType, // e.g., "Point", "Polygon", "LineString"
          coordinates: [], // Empty coordinates - most filters only check properties/type
        },
      };

      // zoom is required for filter evaluation, but we don't have zoom info in Navara yet,
      // so we just pass 0 for now. In the future, we can pass actual zoom from camera.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return filter({ zoom: 0 }, feature as any);
    };
  }

  createValueFn<T extends StyleValue>(
    expr: ValueExpression,
    spec: PropertySpec,
    geometryType = "Point",
  ): (ctx: EvaluationContext) => T {
    // Since v21 `createExpression` requires a `rootKey` locating the expression
    // in the style JSON; it is only used to prefix runtime warnings.
    const result = createExpression(
      expr,
      "paint",
      spec as StylePropertySpecification,
    );

    if (result.result === "error") {
      const errorMsg = result.value
        .map((e: { message: string }) => e.message)
        .join(", ");
      throw new Error(`Failed to create expression: ${errorMsg}`);
    }

    const expression = result.value;

    return (ctx: EvaluationContext) => {
      // Construct a valid GeoJSON Feature for MapLibre's expression evaluator.
      const feature = {
        type: "Feature" as const,
        properties: ctx.properties ?? {},
        geometry: {
          type: geometryType, // e.g., "Point", "Polygon", "LineString"
          coordinates: [], // Empty coordinates - most expressions only access properties
        },
      };

      // zoom is required for expression evaluation, but we don't have zoom info in Navara yet,
      // so we just pass 0 for now. In the future, we can pass actual zoom from camera.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
