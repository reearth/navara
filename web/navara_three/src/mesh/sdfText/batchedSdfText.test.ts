import type {
  TextMesh as NavaraTextMesh,
  TextMaterial as NavaraTextMaterial,
} from "@navaramap/engine";
import type { ShapeTextResult } from "@navaramap/font";
import { Color } from "three";
import { describe, expect, it, vi } from "vitest";

import type { EventContext } from "../../event/context";

import { BatchedSdfTextMesh } from "./batchedSdfText";
import { LabelRow, type LabelDataTexture } from "./labelData";

/** Drains chained `.then` callbacks of the async font-preparation path. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** One square atlas glyph per character — enough for a non-empty layout. */
function shapeResult(text: string): ShapeTextResult {
  return {
    glyphs: [...text].map((_, i) => ({
      glyphId: i + 1,
      fontIndex: 0,
      compositeKey: BigInt(i + 1),
      xAdvance: 500,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
      charClass: 0,
    })),
    metrics: [...text].map((_, i) => ({
      glyphId: i + 1,
      fontIndex: 0,
      compositeKey: BigInt(i + 1),
      atlasX: i * 32,
      atlasY: 0,
      atlasW: 32,
      atlasH: 32,
      bearingX: 0,
      bearingY: 32,
      isColor: false,
    })),
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    lineGap: 0,
  };
}

function makeFontManager() {
  return {
    onAtlasEvicted: vi.fn(() => () => {}),
    isTextPrepared: vi.fn(() => true),
    prepareText: vi.fn(async () => {}),
    shapeText: vi.fn((_font: string, text: string) => shapeResult(text)),
    retainGlyphs: vi.fn(),
    releaseGlyphs: vi.fn(),
    getAtlasTexture: vi.fn(() => null),
    getColorAtlasTexture: vi.fn(() => null),
    isFamily: vi.fn(() => true),
    loadFont: vi.fn(async () => {}),
    unloadFont: vi.fn(async () => {}),
  };
}

/** A layer material with the fields this fix gates on spelled out. */
function material(over: Partial<NavaraTextMaterial> = {}): NavaraTextMaterial {
  return {
    size: 16,
    color: 0xffffff,
    opacity: 1,
    height: 0,
    show: true,
    ...over,
  } as unknown as NavaraTextMaterial;
}

/** A two-feature text mesh event, as the engine hands it over. */
function textMeshEvent(mat: NavaraTextMaterial): NavaraTextMesh {
  return {
    material: mat,
    transform: { tx: 0, ty: 0, tz: 0 },
    geometry: {
      batch_ids: { data: new Float32Array([0, 1]), size: 1 },
      position: { data: new Float32Array([0, 0, 0, 10, 0, 0]), size: 3 },
    },
  } as unknown as NavaraTextMesh;
}

function makeMesh(mat = material()) {
  const fontManager = makeFontManager();
  const ctx = {
    buf: { removeF32: (d: Float32Array) => d },
    fontManager,
    renderFlag: { forceUpdate: false },
  } as unknown as EventContext;
  const mesh = new BatchedSdfTextMesh(ctx, textMeshEvent(mat), "font", {
    layerId: "layer",
  });
  return { mesh, fontManager };
}

// Read back what the vertex shader would sample, rather than the private
// LabelRecord — these are the writes the fix is about.
const store = (mesh: BatchedSdfTextMesh) =>
  (mesh as unknown as { _labelData: LabelDataTexture })._labelData;
const sizeOf = (mesh: BatchedSdfTextMesh, slot: number) =>
  store(mesh).getComponent(slot, LabelRow.POSITION_HIGH_SIZE, 3);
const heightOf = (mesh: BatchedSdfTextMesh, slot: number) =>
  store(mesh).getComponent(slot, LabelRow.POSITION_LOW_HEIGHT, 3);
const opacityOf = (mesh: BatchedSdfTextMesh, slot: number) =>
  store(mesh).getComponent(slot, LabelRow.COLOR_OPACITY, 3);
const redOf = (mesh: BatchedSdfTextMesh, slot: number) =>
  store(mesh).getComponent(slot, LabelRow.COLOR_OPACITY, 0);
const showOf = (mesh: BatchedSdfTextMesh, slot: number) =>
  store(mesh).getComponent(slot, LabelRow.STATE, 2);

// The engine re-sends the whole material on any change event — including ones
// that only moved geometry (terrain heights resolving) or flipped activation.
// Overwriting per-feature values from an unchanged material made every such
// event reset evaluator-set styling to the layer default for a few frames,
// pulsing label sizes until the app's evaluator ran again.
describe("BatchedSdfTextMesh material updates vs per-feature values", () => {
  it("leaves evaluator-set values alone when nothing in the material changed", async () => {
    const { mesh } = makeMesh();
    mesh.setFeatureSizeByBatchIndex(0, 32);
    mesh.setFeatureHeightByBatchIndex(0, 50);
    mesh.setFeatureOpacityByBatchIndex(0, 0.25);
    mesh.setFeatureColorByBatchIndex(0, new Color(0xff0000));

    // A fresh material object carrying identical values (a terrain-height event).
    await mesh._update(textMeshEvent(material()));

    expect(sizeOf(mesh, 0)).toBe(32);
    expect(heightOf(mesh, 0)).toBe(50);
    expect(opacityOf(mesh, 0)).toBe(0.25);
    expect(redOf(mesh, 0)).toBe(1);
  });

  it("keeps an evaluator-set show through an unchanged material", async () => {
    const { mesh } = makeMesh();
    mesh.setTextByBatchIndex(0, "AB");
    expect(showOf(mesh, 0)).toBe(1);
    mesh.setFeatureShowByBatchIndex(0, false);
    expect(showOf(mesh, 0)).toBe(0);

    await mesh._update(textMeshEvent(material()));

    expect(showOf(mesh, 0)).toBe(0);
  });

  it("still applies a genuinely changed material value to every label", async () => {
    const { mesh } = makeMesh();
    mesh.setFeatureSizeByBatchIndex(0, 32);
    mesh.setFeatureSizeByBatchIndex(1, 8);

    // A real `layer.update`: the new default overrides per-feature sizes.
    await mesh._update(textMeshEvent(material({ size: 24 })));

    expect(sizeOf(mesh, 0)).toBe(24);
    expect(sizeOf(mesh, 1)).toBe(24);
  });

  it("applies a changed material show to every label", async () => {
    const { mesh } = makeMesh();
    mesh.setTextByBatchIndex(0, "AB");
    mesh.setFeatureShowByBatchIndex(0, false);

    await mesh._update(textMeshEvent(material({ show: false })));
    expect(showOf(mesh, 0)).toBe(0);

    await mesh._update(textMeshEvent(material({ show: true })));
    expect(showOf(mesh, 0)).toBe(1);
  });

  it("does not reset unrelated per-feature values when one field changes", async () => {
    const { mesh } = makeMesh();
    mesh.setFeatureSizeByBatchIndex(0, 32);
    mesh.setFeatureHeightByBatchIndex(0, 50);

    // Only the colour moved; size and height must survive it.
    await mesh._update(textMeshEvent(material({ color: 0x00ff00 })));

    expect(sizeOf(mesh, 0)).toBe(32);
    expect(heightOf(mesh, 0)).toBe(50);
    expect(redOf(mesh, 0)).toBe(0);
  });

  it("compares against the pre-update material on the async font path", async () => {
    const { mesh, fontManager } = makeMesh();
    mesh.setFeatureSizeByBatchIndex(0, 32);
    // Force the branch that defers _applyUpdate behind prepareText: the
    // comparison must use the material captured before `this._material` was
    // reassigned, or the size change is lost by the time the promise lands.
    fontManager.isTextPrepared.mockReturnValueOnce(false);

    await mesh._update(textMeshEvent(material({ text: "AB", size: 24 })));
    await flushMicrotasks();

    expect(fontManager.prepareText).toHaveBeenCalled();
    expect(sizeOf(mesh, 0)).toBe(24);
  });
});
