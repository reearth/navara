/// <reference lib="webworker" />

import init, {
  loadFont,
  shapeText,
  getFontAtlasView,
  tickFrame,
  type ShapeTextResult as WasmShapeTextResult,
  type WasmShapedGlyph,
  type WasmGlyphMetrics,
} from "@navara/engine-font-worker";

let wasmReady: Promise<unknown> | undefined;

async function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = init();
  }
  await wasmReady;
}

function convertGlyphs(glyphs: WasmShapedGlyph[]) {
  return glyphs.map((g) => ({
    glyphId: g.glyph_id,
    xAdvance: g.x_advance,
    yAdvance: g.y_advance,
    xOffset: g.x_offset,
    yOffset: g.y_offset,
  }));
}

function convertMetrics(metrics: WasmGlyphMetrics[]) {
  return metrics.map((m) => ({
    glyphId: m.glyph_id,
    atlasX: m.atlas_x,
    atlasY: m.atlas_y,
    atlasW: m.atlas_w,
    atlasH: m.atlas_h,
    bearingX: m.bearing_x,
    bearingY: m.bearing_y,
  }));
}

function convertShapeResult(sr: WasmShapeTextResult | undefined) {
  if (!sr) return null;
  return {
    glyphs: convertGlyphs(sr.glyphs),
    metrics: convertMetrics(sr.metrics),
    unitsPerEm: sr.units_per_em,
  };
}

function snapshotAtlas(fontUrl: string) {
  const atlas = getFontAtlasView(fontUrl);
  if (!atlas) return null;
  // Single copy from WASM memory view into a transferable buffer
  const data = atlas.data.slice().buffer;
  return { data, width: atlas.width, height: atlas.height };
}

type FontWorkerMessageType = "loadFont" | "prepareTextBatch" | "tickFrame";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const id: number = msg.id;
  const msgType: FontWorkerMessageType = msg.type;

  try {
    await ensureWasm();

    switch (msgType) {
      case "loadFont": {
        const { url, data } = msg.payload as { url: string; data: ArrayBuffer };
        const bytes = new Uint8Array(data);
        const ok = loadFont(url, bytes.length, (buf: Uint8Array) => {
          buf.set(bytes);
        });
        ctx.postMessage({ id, type: "result", payload: { ok } });
        break;
      }

      case "prepareTextBatch": {
        const { fontUrl, texts } = msg.payload as {
          fontUrl: string;
          texts: string[];
        };

        let anyAtlasChanged = false;
        const results = texts.map((text) => {
          const sr = shapeText(fontUrl, text);
          if (sr?.atlas_changed) anyAtlasChanged = true;
          return { text, shapeResult: convertShapeResult(sr) };
        });

        tickFrame();

        // One atlas transfer for the entire batch
        const atlas = anyAtlasChanged ? snapshotAtlas(fontUrl) : null;

        const transfers: Transferable[] = atlas ? [atlas.data] : [];
        ctx.postMessage(
          {
            id,
            type: "result",
            payload: { results, atlas },
          },
          transfers,
        );
        break;
      }

      case "tickFrame": {
        tickFrame();
        ctx.postMessage({ id, type: "result", payload: null });
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({
      id,
      type: "error",
      payload: { message: String(err) },
    });
  }
};
