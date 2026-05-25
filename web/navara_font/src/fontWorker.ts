/// <reference lib="webworker" />

import init, {
  FontCache,
  composite_key,
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
  return glyphs.map((g) => {
    const out = {
      glyphId: g.glyph_id,
      fontIndex: g.font_index,
      compositeKey: composite_key(g.font_index, g.glyph_id),
      xAdvance: g.x_advance,
      yAdvance: g.y_advance,
      xOffset: g.x_offset,
      yOffset: g.y_offset,
    };
    g.free();
    return out;
  });
}

function convertMetrics(metrics: WasmGlyphMetrics[]) {
  return metrics.map((m) => {
    const out = {
      glyphId: m.glyph_id,
      fontIndex: m.font_index,
      compositeKey: composite_key(m.font_index, m.glyph_id),
      atlasX: m.atlas_x,
      atlasY: m.atlas_y,
      atlasW: m.atlas_w,
      atlasH: m.atlas_h,
      bearingX: m.bearing_x,
      bearingY: m.bearing_y,
      isColor: m.is_color,
    };
    m.free();
    return out;
  });
}

function convertShapeResult(sr: WasmShapeTextResult | undefined) {
  if (!sr) return null;
  const result = {
    glyphs: convertGlyphs(sr.glyphs),
    metrics: convertMetrics(sr.metrics),
    unitsPerEm: sr.units_per_em,
  };
  sr.free();
  return result;
}

function snapshotAtlas(fontUrl: string) {
  const atlas = fontCache.getFontAtlas(fontUrl);
  if (!atlas) return null;
  const snapshot = {
    data: atlas.data.buffer,
    width: atlas.width,
    height: atlas.height,
    channels: atlas.channels,
  };
  atlas.free();
  return snapshot;
}

function snapshotColorAtlas(fontUrl: string) {
  const atlas = fontCache.getColorAtlas(fontUrl);
  if (!atlas) return null;
  const snapshot = {
    data: atlas.data.buffer,
    width: atlas.width,
    height: atlas.height,
    channels: atlas.channels,
  };
  atlas.free();
  return snapshot;
}

type FontWorkerMessageType =
  | "loadFont"
  | "unloadFont"
  | "prepareTextBatch"
  | "tick";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const id: number = msg.id;
  const msgType: FontWorkerMessageType = msg.type;

  try {
    await ensureWasm();

    switch (msgType) {
      case "loadFont": {
        const { url, data, atlasKey, quality } = msg.payload as {
          url: string;
          data: ArrayBuffer;
          atlasKey?: string;
          quality: "low" | "high";
        };
        const bytes = new Uint8Array(data);
        // Map TS quality → WASM mode string. Anything other than "high" is
        // treated as the SDF path by the Rust side (see `wasm_load_font`).
        const mode = quality === "high" ? "msdf" : "sdf";
        const ok = fontCache.loadFont(
          url,
          bytes.length,
          (buf: Uint8Array) => {
            buf.set(bytes);
          },
          atlasKey,
          mode,
        );
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

        let sdfAtlasChanged = false;
        let colorAtlasChanged = false;
        const results = texts.map((text) => {
          const sr = fontCache.shapeText(fontUrl, text);
          if (sr?.atlas_changed) {
            if (sr.is_color) colorAtlasChanged = true;
            else sdfAtlasChanged = true;
          }
          return { text, shapeResult: convertShapeResult(sr) };
        });

        fontCache.tick();

        // Snapshot atlases by atlas key (family name or URL) so shared atlases
        // are returned correctly for font-family faces.
        const atlasKey = fontCache.getAtlasKey(fontUrl) ?? fontUrl;
        const atlas = sdfAtlasChanged ? snapshotAtlas(atlasKey) : null;
        const colorAtlas = colorAtlasChanged
          ? snapshotColorAtlas(atlasKey)
          : null;

        const transfers: Transferable[] = [];
        if (atlas) transfers.push(atlas.data);
        if (colorAtlas) transfers.push(colorAtlas.data);
        ctx.postMessage(
          {
            id,
            type: "result",
            payload: { results, atlas, colorAtlas, atlasKey },
          },
          transfers,
        );
        break;
      }

      case "tick": {
        fontCache.tick();
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
