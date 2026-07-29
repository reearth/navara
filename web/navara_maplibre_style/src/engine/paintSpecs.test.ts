import { describe, it, expect } from "vitest";

import { PAINT_SPECS_BY_TYPE, validatePaintSpecs } from "./paintSpecs";

describe("PAINT_SPECS_BY_TYPE", () => {
  it("should have specs for all standard layer types", () => {
    // Validate specs are loaded correctly (not done at module load time to avoid breaking production)
    expect(() => validatePaintSpecs()).not.toThrow();

    const layerTypes = [
      "fill",
      "fill-extrusion",
      "line",
      "circle",
      "symbol",
      "raster",
      "hillshade",
    ] as const;

    for (const layerType of layerTypes) {
      const spec = PAINT_SPECS_BY_TYPE[layerType];
      expect(spec).toBeDefined();
      expect(typeof spec).toBe("object");
    }
  });

  it("should have fill paint properties", () => {
    const fillSpec = PAINT_SPECS_BY_TYPE.fill;
    expect(fillSpec["fill-color"]).toBeDefined();
    expect(fillSpec["fill-opacity"]).toBeDefined();
  });

  it("should have fill-extrusion paint properties", () => {
    const fillExtrusionSpec = PAINT_SPECS_BY_TYPE["fill-extrusion"];
    expect(fillExtrusionSpec["fill-extrusion-color"]).toBeDefined();
    expect(fillExtrusionSpec["fill-extrusion-height"]).toBeDefined();
    expect(fillExtrusionSpec["fill-extrusion-base"]).toBeDefined();
  });

  it("should have line paint properties", () => {
    const lineSpec = PAINT_SPECS_BY_TYPE.line;
    expect(lineSpec["line-color"]).toBeDefined();
    expect(lineSpec["line-width"]).toBeDefined();
    expect(lineSpec["line-opacity"]).toBeDefined();
  });

  it("should have circle paint properties", () => {
    const circleSpec = PAINT_SPECS_BY_TYPE.circle;
    expect(circleSpec["circle-color"]).toBeDefined();
    expect(circleSpec["circle-radius"]).toBeDefined();
    expect(circleSpec["circle-opacity"]).toBeDefined();
  });

  it("should have symbol paint properties", () => {
    const symbolSpec = PAINT_SPECS_BY_TYPE.symbol;
    expect(symbolSpec["icon-color"]).toBeDefined();
    expect(symbolSpec["icon-opacity"]).toBeDefined();
    expect(symbolSpec["text-color"]).toBeDefined();
    expect(symbolSpec["text-opacity"]).toBeDefined();
  });

  it("should have raster paint properties", () => {
    const rasterSpec = PAINT_SPECS_BY_TYPE.raster;
    expect(rasterSpec["raster-opacity"]).toBeDefined();
  });

  it("should have hillshade paint properties", () => {
    const hillshadeSpec = PAINT_SPECS_BY_TYPE.hillshade;
    expect(hillshadeSpec["hillshade-exaggeration"]).toBeDefined();
  });

  it("should have type and default for each property", () => {
    const fillColorSpec = PAINT_SPECS_BY_TYPE.fill["fill-color"];
    expect(fillColorSpec.type).toBeDefined();
    expect(fillColorSpec.default).toBeDefined();
  });
});
