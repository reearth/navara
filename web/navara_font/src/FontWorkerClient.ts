import type { ConcurrencyManager } from "@navara/worker";

import type {
  ShapeTextResult,
  FontAtlasData,
  BatchPrepareTextResult,
} from "./types";

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

  constructor(workerUrl: string | URL, concurrencyManager: ConcurrencyManager) {
    this._concurrencyManager = concurrencyManager;

    this._worker = new Worker(workerUrl, { type: "module" });

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

    // Trigger WASM init by sending a tick
    this._ready = this._send("tick", undefined).then(() => undefined);
    this._concurrencyManager.increment();
  }

  /** Wait for the WASM module to be initialized in the worker. */
  async ready(): Promise<void> {
    return this._ready;
  }

  /** Load a font file into the worker's FontCache. Transfers the ArrayBuffer.
   *  `atlasKey`: optional shared atlas identifier (e.g. font family name).
   *  When provided, all fonts loaded with the same key share a single SDF atlas. */
  async loadFont(
    url: string,
    data: ArrayBuffer,
    atlasKey?: string,
  ): Promise<{ ok: boolean }> {
    return this._send("loadFont", { url, data, atlasKey }, [data]) as Promise<{
      ok: boolean;
    }>;
  }

  async unloadFont(url: string): Promise<{ ok: boolean }> {
    return this._send("unloadFont", { url }) as Promise<{ ok: boolean }>;
  }

  async tick(): Promise<void> {
    return this._send("tick", undefined) as Promise<void>;
  }

  /** Shape multiple texts in one worker round-trip. */
  async prepareTextBatch(
    fontUrl: string,
    texts: string[],
  ): Promise<BatchPrepareTextResult> {
    const raw = (await this._send("prepareTextBatch", {
      fontUrl,
      texts,
    })) as {
      results: { text: string; shapeResult: ShapeTextResult | null }[];
      atlas: { data: ArrayBuffer; width: number; height: number } | null;
      colorAtlas: { data: ArrayBuffer; width: number; height: number } | null;
      atlasKey: string;
    };

    const wrap = (
      raw: { data: ArrayBuffer; width: number; height: number } | null,
    ): FontAtlasData | null =>
      raw
        ? {
            data: new Uint8Array(raw.data),
            width: raw.width,
            height: raw.height,
          }
        : null;

    return {
      results: raw.results,
      atlas: wrap(raw.atlas),
      colorAtlas: wrap(raw.colorAtlas),
      atlasKey: raw.atlasKey,
    };
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
