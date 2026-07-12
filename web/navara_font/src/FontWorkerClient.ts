import type { ConcurrencyManager } from "@navara/worker";

import type {
  ShapeTextResult,
  FontAtlasData,
  BatchPrepareTextResult,
  FontWorkerMemoryStats,
} from "./types";

export type FontWorkerClientOptions = {
  /** Memory budget for the worker's font caches (font data + atlas pixels).
   * Caps further atlas growth; the WASM heap itself never shrinks. */
  fontBudgetBytes?: number;
};

/**
 * Main-thread client that communicates with the dedicated font Web Worker.
 * Uses a request/response protocol with incrementing message IDs.
 */
export class FontWorkerClient {
  private _worker: Worker;
  private _concurrencyManager: ConcurrencyManager;
  private _nextId = 0;
  private _pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private _ready: Promise<void>;

  constructor(
    workerUrl: string | URL,
    concurrencyManager: ConcurrencyManager,
    options?: FontWorkerClientOptions,
  ) {
    this._concurrencyManager = concurrencyManager;

    this._worker = new Worker(workerUrl, {
      type: import.meta.env.PROD ? undefined : "module",
    });

    this._worker.onmessage = (e: MessageEvent) => {
      const { id, type, payload } = e.data;
      const pending = this._pending.get(id);
      if (!pending) return;
      this._pending.delete(id);

      if (type === "error") {
        pending.reject(new Error(payload.message));
      } else {
        pending.resolve(payload);
      }
    };

    this._worker.onerror = (e) => {
      console.error("FontWorkerClient: worker error", e);
      // Reject all pending requests so callers don't hang indefinitely.
      this.dispose();
    };

    // Trigger WASM init and resolve once the worker is ready; the init
    // payload also delivers the memory budget.
    this._ready = this._send("init", {
      fontBudgetBytes: options?.fontBudgetBytes,
    }).then(() => undefined);
    this._concurrencyManager.increment();
  }

  /** Wait for the WASM module to be initialized in the worker. */
  async ready(): Promise<void> {
    return this._ready;
  }

  /** Load a font file into the worker's FontCache. Transfers the ArrayBuffer.
   *  `atlasKey`: optional shared atlas identifier (e.g. font family name).
   *  When provided, all fonts loaded with the same key share a single atlas.
   *  `highQuality`: whether to use the high-quality atlas raster path. The Rust side creates the
   *  atlas with this mode on the first load; subsequent loads under the same
   *  `atlasKey` are expected to reuse the same quality (the TS layer
   *  guarantees this by including the highQuality flag in both `url` and `atlasKey`). */
  async loadFont(
    url: string,
    data: ArrayBuffer,
    atlasKey: string | undefined,
    highQuality: boolean,
  ): Promise<{ ok: boolean }> {
    return this._send("loadFont", { url, data, atlasKey, highQuality }, [
      data,
    ]) as Promise<{
      ok: boolean;
    }>;
  }

  async unloadFont(url: string): Promise<{ ok: boolean }> {
    return this._send("unloadFont", { url }) as Promise<{ ok: boolean }>;
  }

  /** Add one visible-label reference to each glyph (composite keys) under
   *  `atlasKey`. Fire-and-forget; the worker replies so `_pending` is cleared.
   *  Transfers the key buffer — the caller discards it after this call. */
  retainGlyphs(atlasKey: string, keys: BigUint64Array): void {
    void this._send("retainGlyphs", { atlasKey, keys }, [keys.buffer]);
  }

  /** Drop one visible-label reference from each glyph under `atlasKey`. */
  releaseGlyphs(atlasKey: string, keys: BigUint64Array): void {
    void this._send("releaseGlyphs", { atlasKey, keys }, [keys.buffer]);
  }

  /** Shape multiple texts in one worker round-trip. */
  async prepareTextBatch(
    fontUrl: string,
    texts: string[],
  ): Promise<BatchPrepareTextResult> {
    type RawAtlas = {
      data: ArrayBuffer;
      width: number;
      height: number;
      channels: number;
    };
    const raw = (await this._send("prepareTextBatch", {
      fontUrl,
      texts,
    })) as {
      results: { text: string; shapeResult: ShapeTextResult | null }[];
      atlas: RawAtlas | null;
      colorAtlas: RawAtlas | null;
      atlasKey: string;
      evicted: boolean;
    };

    const wrap = (raw: RawAtlas | null): FontAtlasData | null =>
      raw
        ? {
            data: new Uint8Array(raw.data),
            width: raw.width,
            height: raw.height,
            channels: raw.channels,
          }
        : null;

    return {
      results: raw.results,
      atlas: wrap(raw.atlas),
      colorAtlas: wrap(raw.colorAtlas),
      atlasKey: raw.atlasKey,
      evicted: raw.evicted,
    };
  }

  /** Snapshot of the worker's WASM heap and font-cache memory usage. */
  async getMemoryStats(): Promise<FontWorkerMemoryStats> {
    return this._send(
      "getMemoryStats",
      undefined,
    ) as Promise<FontWorkerMemoryStats>;
  }

  dispose(): void {
    this._worker.terminate();
    for (const pending of this._pending.values()) {
      pending.reject(new Error("FontWorkerClient disposed"));
    }
    this._pending.clear();
    this._concurrencyManager.decrement();
  }

  private _send(
    type: string,
    payload: unknown,
    transfers?: Transferable[],
  ): Promise<unknown> {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({ id, type, payload }, transfers ?? []);
    });
  }
}
