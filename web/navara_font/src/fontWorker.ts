/// <reference lib="webworker" />

import init, {
  FontCache,
  composite_key,
  type CurveDirtyRanges as WasmCurveDirtyRanges,
  type ColorDirtyRangesJs as WasmColorDirtyRanges,
  type ShapeTextCurvesResult as WasmShapeTextCurvesResult,
  type ShapeTextResult as WasmShapeTextResult,
  type WasmGlyphMetrics,
  type WasmShapedCurveGlyph,
  type WasmShapedGlyph,
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
  };
  atlas.free();
  return snapshot;
}

type FontWorkerMessageType =
  | "loadFont"
  | "unloadFont"
  | "prepareTextBatch"
  | "prepareTextCurvesBatch"
  | "tickFrame";

// ---------------------------------------------------------------------------
// Slug-style curve pipeline conversion helpers.
// ---------------------------------------------------------------------------

function convertCurveGlyphs(glyphs: WasmShapedCurveGlyph[]) {
  return glyphs.map((g) => {
    const out = {
      glyphId: g.glyph_id,
      fontIndex: g.font_index,
      headerSlot: g.header_slot,
      xAdvance: g.x_advance,
      yAdvance: g.y_advance,
      xOffset: g.x_offset,
      yOffset: g.y_offset,
    };
    g.free();
    return out;
  });
}

function convertCurveShapeResult(sr: WasmShapeTextCurvesResult | undefined) {
  if (!sr) return null;
  const out = {
    glyphs: convertCurveGlyphs(sr.glyphs),
    unitsPerEm: sr.units_per_em,
    isColor: sr.is_color,
  };
  sr.free();
  return out;
}

function curveRange(start: number, end: number, changed: boolean) {
  return changed ? { start, end } : null;
}

/**
 * Pull the four outline buffers out of WASM whenever any of them has a dirty
 * range. The snapshot includes both the full (typed-array view-of-copied)
 * data and the dirty ranges so the main thread can pick texSubImage2D over a
 * full reupload when only a sub-range changed.
 */
function snapshotOutlineBuffers(atlasKey: string) {
  const dirty: WasmCurveDirtyRanges | undefined =
    fontCache.takeCurveDirtyRanges(atlasKey);
  if (
    !dirty ||
    (!dirty.headers_changed &&
      !dirty.bands_changed &&
      !dirty.band_curves_changed &&
      !dirty.curves_changed)
  ) {
    dirty?.free();
    return null;
  }

  const headers = fontCache.getGlyphHeaderBuffer(atlasKey);
  const bandData = fontCache.getBandDataBuffer(atlasKey);
  const bandCurves = fontCache.getBandCurvesBuffer(atlasKey);
  const curveData = fontCache.getCurveDataBuffer(atlasKey);
  if (!headers || !bandData || !bandCurves || !curveData) {
    dirty.free();
    return null;
  }

  const payload = {
    glyphHeaders: headers.buffer,
    bandData: bandData.buffer,
    bandCurves: bandCurves.buffer,
    curveData: curveData.buffer,
    dirty: {
      headers: curveRange(dirty.headers_start, dirty.headers_end, dirty.headers_changed),
      bandData: curveRange(dirty.bands_start, dirty.bands_end, dirty.bands_changed),
      bandCurves: curveRange(
        dirty.band_curves_start,
        dirty.band_curves_end,
        dirty.band_curves_changed,
      ),
      curveData: curveRange(dirty.curves_start, dirty.curves_end, dirty.curves_changed),
    },
  };
  dirty.free();
  return payload;
}

function snapshotColorBuffers(atlasKey: string) {
  const dirty: WasmColorDirtyRanges | undefined =
    fontCache.takeColorDirtyRanges(atlasKey);
  if (
    !dirty ||
    (!dirty.layer_headers_changed &&
      !dirty.paint_params_changed &&
      !dirty.clip_records_changed)
  ) {
    dirty?.free();
    return null;
  }

  const layerHeaders = fontCache.getColorLayerHeaderBuffer(atlasKey);
  const paintParams = fontCache.getColorPaintParamsBuffer(atlasKey);
  const clipRecords = fontCache.getColorClipRecordsBuffer(atlasKey);
  if (!layerHeaders || !paintParams || !clipRecords) {
    dirty.free();
    return null;
  }

  const payload = {
    layerHeaders: layerHeaders.buffer,
    paintParams: paintParams.buffer,
    clipRecords: clipRecords.buffer,
    dirty: {
      layerHeaders: curveRange(
        dirty.layer_headers_start,
        dirty.layer_headers_end,
        dirty.layer_headers_changed,
      ),
      paintParams: curveRange(
        dirty.paint_params_start,
        dirty.paint_params_end,
        dirty.paint_params_changed,
      ),
      clipRecords: curveRange(
        dirty.clip_records_start,
        dirty.clip_records_end,
        dirty.clip_records_changed,
      ),
    },
  };
  dirty.free();
  return payload;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  const id: number = msg.id;
  const msgType: FontWorkerMessageType = msg.type;

  try {
    await ensureWasm();

    switch (msgType) {
      case "loadFont": {
        const { url, data, atlasKey } = msg.payload as {
          url: string;
          data: ArrayBuffer;
          atlasKey?: string;
        };
        const bytes = new Uint8Array(data);
        const ok = fontCache.loadFont(
          url,
          bytes.length,
          (buf: Uint8Array) => {
            buf.set(bytes);
          },
          atlasKey,
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

        fontCache.tickFrame();

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

      case "prepareTextCurvesBatch": {
        const { fontUrl, texts } = msg.payload as {
          fontUrl: string;
          texts: string[];
        };

        const results = texts.map((text) => {
          const sr = fontCache.shapeTextCurves(fontUrl, text);
          return { text, shapeResult: convertCurveShapeResult(sr) };
        });

        fontCache.tickFrame();

        const atlasKey = fontCache.getAtlasKey(fontUrl) ?? fontUrl;
        const outline = snapshotOutlineBuffers(atlasKey);
        const color = snapshotColorBuffers(atlasKey);

        const transfers: Transferable[] = [];
        if (outline) {
          transfers.push(outline.glyphHeaders);
          transfers.push(outline.bandData);
          transfers.push(outline.bandCurves);
          transfers.push(outline.curveData);
        }
        if (color) {
          transfers.push(color.layerHeaders);
          transfers.push(color.paintParams);
          transfers.push(color.clipRecords);
        }

        ctx.postMessage(
          {
            id,
            type: "result",
            payload: { results, atlasKey, outline, color },
          },
          transfers,
        );
        break;
      }

      case "tickFrame": {
        fontCache.tickFrame();
        // Sweep the curve-pipeline buffers for cold glyphs. The legacy SDF
        // atlas evicts opportunistically on allocation failure; the curve
        // atlases need an explicit per-frame tick so their LRU stays bounded
        // even when no new glyphs are arriving.
        fontCache.evictColdCurveGlyphs();
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
