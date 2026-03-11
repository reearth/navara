/// <reference lib="webworker" />

import init, {
  FontCache,
  type ShapeTextResult as WasmShapeTextResult,
  type WasmShapedGlyph,
  type WasmGlyphMetrics,
} from "@navara/engine-font-worker";

let fontCache: FontCache;

async function ensureWasm(): Promise<void> {
  if (!fontCache) {
    await init();
    fontCache = new FontCache();
  }
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
  const atlas = fontCache.getFontAtlas(fontUrl);
  if (!atlas) return null;
  return { data: atlas.data.buffer, width: atlas.width, height: atlas.height };
}

type FontWorkerMessageType =
  | "loadFont"
  | "unloadFont"
  | "prepareTextBatch"
  | "tickFrame";

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
        const ok = fontCache.loadFont(url, bytes.length, (buf: Uint8Array) => {
          buf.set(bytes);
        });
        ctx.postMessage({ id, type: "result", payload: { ok } });
        break;
      }

      case "unloadFont": {
        const { url } = msg.payload as { url: string };
        const ok = fontCache.unloadFont(url);
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
          const sr = fontCache.shapeText(fontUrl, text);
          if (sr?.atlas_changed) anyAtlasChanged = true;
          return { text, shapeResult: convertShapeResult(sr) };
        });

        fontCache.tickFrame();

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
        fontCache.tickFrame();
        ctx.postMessage({ id, type: "result", payload: null });
        break;
      }

      default: {
        ctx.postMessage({
          id,
          type: "error",
          payload: { message: `Unknown message type: ${msgType}` },
        });
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
