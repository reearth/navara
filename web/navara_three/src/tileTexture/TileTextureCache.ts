import type { TileHandle } from "@navara/core";

import type {
  AtlasFactory,
  CacheEntry,
  CompositeOutputs,
  DirtyReason,
} from "./types";

/** Dev-build-only refcount diagnostics (never throws in production). */
const DEV =
  typeof import.meta !== "undefined" && !!(import.meta as ImportMeta).env?.DEV;

export type TileTextureCacheOptions = {
  /** Side length (in pixels) of the composite render targets. */
  size: number;
  /** Builds the MRT trio. Injected so unit tests pass fakes. */
  atlasFactory: AtlasFactory;
};

/**
 * Pure cache layer for per-tile composite atlases.
 *
 * Why: TileMesh previously owned its own WebGLRenderTargets and had no way to
 * coalesce updates from independent sources (vector revision, hillshade
 * backfill, material change). Lifting these responsibilities here lets the
 * compositor render N source textures into one atlas only when something
 * actually changes, and makes the bookkeeping testable without three.js.
 */
export class TileTextureCache {
  private readonly entries = new Map<TileHandle, CacheEntry>();
  private readonly opts: TileTextureCacheOptions;

  constructor(opts: TileTextureCacheOptions) {
    this.opts = opts;
  }

  /**
   * Acquire (or create) the atlas for a handle. Refcounted: a TileMesh
   * acquires once on construction and releases once on dispose.
   * Newly-created entries start dirty in every category so the first composite
   * pass paints them.
   */
  acquire(handle: TileHandle): CompositeOutputs {
    let entry = this.entries.get(handle);
    if (!entry) {
      const atlas = this.opts.atlasFactory(this.opts.size);
      entry = {
        handle,
        atlas,
        refCount: 0,
        dirty: new Set<DirtyReason>([
          "material",
          "texture-binding",
          "vector-revision",
          "hillshade",
        ]),
      };
      this.entries.set(handle, entry);
    }
    entry.refCount++;
    return {
      color: entry.atlas.color,
      attr: entry.atlas.attr,
      normal: entry.atlas.normal,
    };
  }

  /**
   * Decrement refcount. When the last holder releases, the atlas is disposed
   * and the entry forgotten.
   */
  release(handle: TileHandle): void {
    const entry = this.entries.get(handle);
    if (!entry) {
      if (DEV) {
        console.error(
          `TileTextureCache.release: no entry for handle ${handle} (double release or release without acquire)`,
        );
      }
      return;
    }
    entry.refCount--;
    if (DEV && entry.refCount < 0) {
      console.error(
        `TileTextureCache.release: refcount went negative for handle ${handle}`,
      );
    }
    if (entry.refCount <= 0) {
      entry.atlas.dispose();
      this.entries.delete(handle);
    }
  }

  /** Mark an entry dirty for a given reason. No-op if handle isn't tracked. */
  markDirty(handle: TileHandle, reason: DirtyReason): void {
    const entry = this.entries.get(handle);
    if (!entry) return;
    entry.dirty.add(reason);
  }

  /**
   * Return the set of dirty reasons (and clear them) for a handle. Returns
   * null when the handle isn't tracked or has nothing dirty — compositor uses
   * that to skip the offscreen pass.
   */
  consumeDirty(handle: TileHandle): Set<DirtyReason> | null {
    const entry = this.entries.get(handle);
    if (!entry || entry.dirty.size === 0) return null;
    const reasons = entry.dirty;
    entry.dirty = new Set<DirtyReason>();
    return reasons;
  }

  /** Peek without clearing — used by the compositor's scheduling pass. */
  isDirty(handle: TileHandle): boolean {
    const entry = this.entries.get(handle);
    return !!entry && entry.dirty.size > 0;
  }

  /** Atlas accessor for the compositor's internal render path. */
  getEntry(handle: TileHandle): CacheEntry | undefined {
    return this.entries.get(handle);
  }

  /**
   * Return the outputs for a handle that was already acquired. Unlike
   * acquire(), does NOT touch the refcount — use this from places that just
   * need to bind the atlas textures (e.g. TileMesh.initMaterial after the
   * constructor already acquired the entry).
   */
  getOutputs(handle: TileHandle): CompositeOutputs | undefined {
    const entry = this.entries.get(handle);
    if (!entry) return undefined;
    return {
      color: entry.atlas.color,
      attr: entry.atlas.attr,
      normal: entry.atlas.normal,
    };
  }

  /** Iterate all live entries. Used by compositor.update(). */
  entriesIter(): IterableIterator<CacheEntry> {
    return this.entries.values();
  }

  /** Number of tracked entries (testing/debug). */
  get size(): number {
    return this.entries.size;
  }

  /** Dispose all atlases and clear. Called on view shutdown. */
  disposeAll(): void {
    for (const entry of this.entries.values()) {
      if (DEV && entry.refCount > 0) {
        console.error(
          `TileTextureCache.disposeAll: handle ${entry.handle} still has refcount ${entry.refCount} (leaked acquire)`,
        );
      }
      entry.atlas.dispose();
    }
    this.entries.clear();
  }
}
