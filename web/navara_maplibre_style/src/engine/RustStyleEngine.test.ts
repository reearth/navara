import { describe, it, expect } from "vitest";

import { RustStyleEngine } from "./RustStyleEngine";

describe("RustStyleEngine", () => {
  const engine = new RustStyleEngine();

  describe("getPaintSpec", () => {
    it("should return spec for fill-color", () => {
      const spec = engine.getPaintSpec("fill", "fill-color");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
      expect(spec?.default).toBeDefined();
    });

    it("should return spec for fill-extrusion-color", () => {
      const spec = engine.getPaintSpec(
        "fill-extrusion",
        "fill-extrusion-color",
      );
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for fill-extrusion-height", () => {
      const spec = engine.getPaintSpec(
        "fill-extrusion",
        "fill-extrusion-height",
      );
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return spec for line-color", () => {
      const spec = engine.getPaintSpec("line", "line-color");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for line-width", () => {
      const spec = engine.getPaintSpec("line", "line-width");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return spec for circle-color", () => {
      const spec = engine.getPaintSpec("circle", "circle-color");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for circle-radius", () => {
      const spec = engine.getPaintSpec("circle", "circle-radius");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return spec for icon-color", () => {
      const spec = engine.getPaintSpec("symbol", "icon-color");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for text-color", () => {
      const spec = engine.getPaintSpec("symbol", "text-color");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("color");
    });

    it("should return spec for hillshade-exaggeration", () => {
      const spec = engine.getPaintSpec("hillshade", "hillshade-exaggeration");
      expect(spec).toBeDefined();
      expect(spec?.type).toBe("number");
    });

    it("should return undefined for unknown layer type", () => {
      const spec = engine.getPaintSpec("unknown" as "fill", "fill-color");
      expect(spec).toBeUndefined();
    });

    it("should return undefined for unknown property", () => {
      const spec = engine.getPaintSpec("fill", "unknown-property");
      expect(spec).toBeUndefined();
    });
  });
});
