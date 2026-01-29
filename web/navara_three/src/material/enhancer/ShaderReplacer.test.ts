import { describe, expect, it } from "vitest";

import {
  ShaderReplacer,
  createShaderReplacer,
  type ShaderMarkers,
} from "./ShaderReplacer";

const MARKERS = {
  vertex: {
    START: "// MARKER_START",
    END: "// MARKER_END",
  },
  fragment: {},
} satisfies ShaderMarkers;

type TestMarkers = typeof MARKERS;

describe("ShaderReplacer", () => {
  const baseSource = [
    "line1",
    MARKERS.vertex.START,
    "content",
    MARKERS.vertex.END,
    "line2",
  ].join("\n");

  describe("insertBefore", () => {
    it("should insert code before the marker and preserve the marker", () => {
      const replacer = new ShaderReplacer<TestMarkers>(baseSource);
      replacer.insertBefore(MARKERS.vertex.START, "inserted");

      expect(replacer.source).toContain(`inserted\n${MARKERS.vertex.START}`);
    });

    it("should throw when marker is not found", () => {
      const replacer = new ShaderReplacer<TestMarkers>("no markers here");
      expect(() =>
        replacer.insertBefore(MARKERS.vertex.START, "code"),
      ).toThrow();
    });
  });

  describe("insertAfter", () => {
    it("should insert code after the marker and preserve the marker", () => {
      const replacer = new ShaderReplacer<TestMarkers>(baseSource);
      replacer.insertAfter(MARKERS.vertex.END, "inserted");

      expect(replacer.source).toContain(`${MARKERS.vertex.END}\ninserted`);
    });

    it("should throw when marker is not found", () => {
      const replacer = new ShaderReplacer<TestMarkers>("no markers here");
      expect(() => replacer.insertAfter(MARKERS.vertex.END, "code")).toThrow();
    });
  });

  describe("replaceBlock", () => {
    it("should replace content between markers and preserve markers", () => {
      const replacer = new ShaderReplacer<TestMarkers>(baseSource);
      replacer.replaceBlock(
        { start: MARKERS.vertex.START, end: MARKERS.vertex.END },
        "REPLACED",
      );

      expect(replacer.source).toContain(`${MARKERS.vertex.START}
REPLACED
${MARKERS.vertex.END}`);
      expect(replacer.source).not.toContain("content");
    });

    it("should throw when start marker is not found", () => {
      const replacer = new ShaderReplacer<TestMarkers>("no markers here");
      expect(() =>
        replacer.replaceBlock(
          { start: MARKERS.vertex.START, end: MARKERS.vertex.END },
          "code",
        ),
      ).toThrow("start marker");
    });

    it("should throw when end marker is not found", () => {
      const source = `before\n${MARKERS.vertex.START}\nno end`;
      const replacer = new ShaderReplacer<TestMarkers>(source);
      expect(() =>
        replacer.replaceBlock(
          { start: MARKERS.vertex.START, end: MARKERS.vertex.END },
          "code",
        ),
      ).toThrow("end marker");
    });
  });

  describe("chaining", () => {
    it("should support chaining multiple operations", () => {
      const replacer = new ShaderReplacer<TestMarkers>(baseSource);
      const result = replacer
        .insertBefore(MARKERS.vertex.START, "before_start")
        .insertAfter(MARKERS.vertex.END, "after_end");

      expect(result).toBe(replacer);
      expect(replacer.source).toContain("before_start");
      expect(replacer.source).toContain("after_end");
    });
  });

  describe("createShaderReplacer", () => {
    it("should create a ShaderReplacer instance", () => {
      const replacer = createShaderReplacer<TestMarkers>(baseSource);
      expect(replacer).toBeInstanceOf(ShaderReplacer);
      expect(replacer.source).toBe(baseSource);
    });
  });
});
