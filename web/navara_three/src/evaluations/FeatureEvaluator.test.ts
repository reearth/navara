import { Object3D } from "three";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { FeatureHandler } from "../event/context";

import { FeatureEvaluator, type GeometryType } from "./FeatureEvaluator";

// Mock worker module to avoid os.cpus() error in test environment
vi.mock("@navaramap/worker", () => ({}));

describe("FeatureEvaluator", () => {
  let mockHandler: FeatureHandler;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create mock FeatureHandler with minimal implementation
    mockHandler = {
      readAllBatchedProperties: vi.fn((_, callback) => {
        // Simulate a single batch with empty properties object
        callback(0, 0, {});
      }),
      readFilteredBatchedProperties: vi.fn((_, __, callback) => {
        // Simulate a single batch with empty properties object (not array)
        // Production code expects Record<string, unknown>, not an array
        callback(0, 0, {});
      }),
    } as unknown as FeatureHandler;

    // Spy on console.warn to check for warnings
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("determineGeometryType", () => {
    it("should pass through valid geometry type literals", () => {
      // Test representative types: billboard and text (critical for symbol layers)
      const mockMesh = new Object3D();
      (
        mockMesh as Object3D & { getGeometryType(): GeometryType }
      ).getGeometryType = () => "billboard";

      const evaluator = new FeatureEvaluator(
        mockHandler,
        "test-layer",
        0n,
        mockMesh,
      );

      let capturedGeometryType: GeometryType | undefined;
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });

      expect(capturedGeometryType).toBe("billboard");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should return undefined and warn once for invalid values", () => {
      const mockMesh = new Object3D();
      (mockMesh as Object3D & { getGeometryType(): string }).getGeometryType =
        () => "invalid-type";

      const evaluator = new FeatureEvaluator(
        mockHandler,
        "test-layer",
        0n,
        mockMesh,
      );

      // First evaluation - should warn
      let capturedGeometryType: GeometryType | undefined;
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });

      expect(capturedGeometryType).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid geometry type returned from getGeometryType(): "invalid-type"',
        ),
      );

      // Second evaluation - should NOT warn again (same object)
      consoleWarnSpy.mockClear();
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });

      expect(capturedGeometryType).toBeUndefined();
      expect(consoleWarnSpy).not.toHaveBeenCalled(); // No additional warnings
    });

    it("should return undefined without warning when getGeometryType is not present", () => {
      const mockMesh = new Object3D();
      // No getGeometryType method

      const evaluator = new FeatureEvaluator(
        mockHandler,
        "test-layer",
        0n,
        mockMesh,
      );

      let capturedGeometryType: GeometryType | undefined;
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });

      expect(capturedGeometryType).toBeUndefined();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should read geometryType dynamically on each evaluation (critical for symbol layers)", () => {
      const mockMesh = new Object3D();
      let currentType: GeometryType = "billboard";
      (
        mockMesh as Object3D & { getGeometryType(): GeometryType }
      ).getGeometryType = () => currentType;

      const evaluator = new FeatureEvaluator(
        mockHandler,
        "test-layer",
        0n,
        mockMesh,
      );

      // First read - should be "billboard"
      let capturedGeometryType: GeometryType | undefined;
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });
      expect(capturedGeometryType).toBe("billboard");

      // Change the geometry type (simulates symbol layer switching from billboard to text)
      currentType = "text";

      // Second read - should be "text" (not cached)
      evaluator.readFeatureProperties(({ meshGeomType: gt }) => {
        capturedGeometryType = gt;
      });
      expect(capturedGeometryType).toBe("text");
    });
  });
});
