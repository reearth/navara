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

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const id: number = msg.id;
  const msgType: string = msg.type;

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

      case "prepareText": {
        const { fontUrl, text } = msg.payload as {
          fontUrl: string;
          text: string;
        };

        // Shape text + rasterize glyphs into atlas (all in WASM)
        const shapeResult: WasmShapeTextResult | undefined = shapeText(
          fontUrl,
          text,
        );
        tickFrame();

        // Convert WASM class instances to plain objects for structured clone
        const glyphs = shapeResult?.glyphs.map((g: WasmShapedGlyph) => ({
          glyphId: g.glyph_id,
          xAdvance: g.x_advance,
          yAdvance: g.y_advance,
          xOffset: g.x_offset,
          yOffset: g.y_offset,
          cluster: g.cluster,
        }));

        const metrics = shapeResult?.metrics.map((m: WasmGlyphMetrics) => ({
          glyphId: m.glyph_id,
          atlasX: m.atlas_x,
          atlasY: m.atlas_y,
          atlasW: m.atlas_w,
          atlasH: m.atlas_h,
          bearingX: m.bearing_x,
          bearingY: m.bearing_y,
          advance: m.advance,
        }));

        // Only copy atlas when new glyphs were actually rasterized
        let atlasData: ArrayBuffer | null = null;
        let atlasWidth = 0;
        let atlasHeight = 0;
        if (shapeResult?.atlas_changed) {
          const atlas = getFontAtlasView(fontUrl);
          if (atlas) {
            // Single copy from WASM memory view into a transferable buffer
            atlasData = atlas.data.slice().buffer;
            atlasWidth = atlas.width;
            atlasHeight = atlas.height;
          }
        }

        const response = {
          id,
          type: "result" as const,
          payload: {
            shapeResult: shapeResult
              ? { glyphs, metrics, unitsPerEm: shapeResult.units_per_em }
              : null,
            atlas: atlasData
              ? { data: atlasData, width: atlasWidth, height: atlasHeight }
              : null,
          },
        };

        // Transfer atlas ArrayBuffer for zero-copy
        const transfers: Transferable[] = atlasData ? [atlasData] : [];
        ctx.postMessage(response, transfers);
        break;
      }

      case "prepareTextBatch": {
        const { fontUrl, texts } = msg.payload as {
          fontUrl: string;
          texts: string[];
        };

        const results: {
          text: string;
          shapeResult: {
            glyphs: {
              glyphId: number;
              xAdvance: number;
              yAdvance: number;
              xOffset: number;
              yOffset: number;
              cluster: number;
            }[];
            metrics: {
              glyphId: number;
              atlasX: number;
              atlasY: number;
              atlasW: number;
              atlasH: number;
              bearingX: number;
              bearingY: number;
              advance: number;
            }[];
            unitsPerEm: number;
          } | null;
        }[] = [];
        let anyAtlasChanged = false;

        for (const text of texts) {
          const sr = shapeText(fontUrl, text);
          if (sr?.atlas_changed) anyAtlasChanged = true;

          const glyphs = sr?.glyphs.map((g: WasmShapedGlyph) => ({
            glyphId: g.glyph_id,
            xAdvance: g.x_advance,
            yAdvance: g.y_advance,
            xOffset: g.x_offset,
            yOffset: g.y_offset,
            cluster: g.cluster,
          }));

          const metrics = sr?.metrics.map((m: WasmGlyphMetrics) => ({
            glyphId: m.glyph_id,
            atlasX: m.atlas_x,
            atlasY: m.atlas_y,
            atlasW: m.atlas_w,
            atlasH: m.atlas_h,
            bearingX: m.bearing_x,
            bearingY: m.bearing_y,
            advance: m.advance,
          }));

          results.push({
            text,
            shapeResult:
              sr && glyphs && metrics
                ? { glyphs, metrics, unitsPerEm: sr.units_per_em }
                : null,
          });
        }

        tickFrame();

        // One atlas transfer for the entire batch
        let batchAtlasData: ArrayBuffer | null = null;
        let batchAtlasWidth = 0;
        let batchAtlasHeight = 0;
        if (anyAtlasChanged) {
          const atlas = getFontAtlasView(fontUrl);
          if (atlas) {
            batchAtlasData = atlas.data.slice().buffer;
            batchAtlasWidth = atlas.width;
            batchAtlasHeight = atlas.height;
          }
        }

        const batchResponse = {
          id,
          type: "result" as const,
          payload: {
            results,
            atlas: batchAtlasData
              ? {
                  data: batchAtlasData,
                  width: batchAtlasWidth,
                  height: batchAtlasHeight,
                }
              : null,
          },
        };

        const batchTransfers: Transferable[] = batchAtlasData
          ? [batchAtlasData]
          : [];
        ctx.postMessage(batchResponse, batchTransfers);
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
