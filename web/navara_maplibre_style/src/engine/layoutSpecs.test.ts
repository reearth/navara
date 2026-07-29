import { describe, it, expect } from "vitest";

import { LAYOUT_SPECS_BY_TYPE, validateLayoutSpecs } from "./layoutSpecs";

describe("layoutSpecs", () => {
  it("should load all layout specs from MapLibre Style Spec", () => {
    // Verify that layout specs are loaded for all layer types
    const layerTypes = [
      "symbol",
      "line",
      "circle",
      "fill",
      "fill-extrusion",
      "raster",
      "hillshade",
    ];

    for (const layerType of layerTypes) {
      const specs =
        LAYOUT_SPECS_BY_TYPE[layerType as keyof typeof LAYOUT_SPECS_BY_TYPE];
      // Some layer types may have undefined/empty layout specs (e.g., raster, hillshade)
      // Just verify the key exists in the object
      expect(layerType in LAYOUT_SPECS_BY_TYPE).toBe(true);

      // Verify specs are either undefined or an object
      expect(specs === undefined || typeof specs === "object").toBe(true);
    }
  });

  it("should validate layout specs without throwing", () => {
    // This test catches breaking changes in @maplibre/maplibre-gl-style-spec
    expect(() => validateLayoutSpecs()).not.toThrow();
  });

  it("should have correct spec format for symbol layout properties", () => {
    const symbolSpecs = LAYOUT_SPECS_BY_TYPE.symbol;
    expect(symbolSpecs).toBeDefined();

    // Verify key symbol layout properties exist with correct structure
    const textField = symbolSpecs["text-field"];
    expect(textField).toBeDefined();
    expect(textField).toHaveProperty("type");

    const iconImage = symbolSpecs["icon-image"];
    expect(iconImage).toBeDefined();
    expect(iconImage).toHaveProperty("type");

    const textSize = symbolSpecs["text-size"];
    expect(textSize).toBeDefined();
    expect(textSize).toHaveProperty("type");

    const iconSize = symbolSpecs["icon-size"];
    expect(iconSize).toBeDefined();
    expect(iconSize).toHaveProperty("type");
  });

  it("should use MapLibre Style Spec defaults for symbol properties", () => {
    const symbolSpecs = LAYOUT_SPECS_BY_TYPE.symbol;

    // Verify text-size default matches MapLibre Style Spec (16, not hardcoded 1)
    // This was the key bug: hardcoded defaults drifted from spec
    const textSize = symbolSpecs["text-size"] as { default: number };
    expect(textSize.default).toBe(16);

    // Verify icon-size default matches MapLibre Style Spec (1)
    const iconSize = symbolSpecs["icon-size"] as { default: number };
    expect(iconSize.default).toBe(1);

    // Verify text-field default matches MapLibre Style Spec (empty string)
    const textField = symbolSpecs["text-field"] as { default: string };
    expect(textField.default).toBe("");

    // Verify icon-image default is undefined (optional property)
    const iconImage = symbolSpecs["icon-image"] as { default?: unknown };
    expect(iconImage.default).toBeUndefined();
  });
});
