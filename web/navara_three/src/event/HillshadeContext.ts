import type { DataTexture } from "three";

import type { ViewContext } from "../core";
import { HillshadeNormalMapGenerator } from "../utils/hillshadeNormalMapGenerator";

import type { TileHandler } from "./context";

/**
 * Hillshade decoder configuration from Rust
 */
export type HillshadeConfig = {
  rgbScaler: number[];
  boundary: number;
  minOffset: number;
  maxOffset: number;
  epsilon: number;
  offset: number;
}

/**
 * Temporary DEM texture storage entry
 * Kept until all 4 edges arrive (directions: 0=Left, 1=Right, 2=Top, 3=Bottom)
 */
type TempDemEntry = {
  demTexture: DataTexture;
  receivedEdges: Set<number>;
  metersPerTexel: number;
  hillshadeConfig: HillshadeConfig;
}

/**
 * Context for managing hillshade-related state and resources
 * Centralizes all hillshade processing state to avoid scattered global variables
 */
export class HillshadeContext {
  /** Shared normal map generator for offline rendering */
  private normalMapGenerator: HillshadeNormalMapGenerator | null = null;

  /** Pending edge updates that arrived before the main texture was created */
  readonly pendingEdges = new Map<string, Map<number, Uint8Array>>();

  /**
   * Temporary storage for DEM textures while waiting for edge updates
   * entityId → { demTexture, receivedEdges, metersPerTexel, timeout }
   */
  readonly tempDemTextures = new Map<string, TempDemEntry>();

  /**
   * Cached hillshade decoder config from first hillshade layer
   * Assumes all hillshade layers in the same view use the same decoder
   */
  private cachedConfig: HillshadeConfig | null = null;

  /**
   * Get or create the normal map generator
   * @param viewContext - ViewContext to get the renderer from
   */
  getOrCreateGenerator(viewContext: ViewContext): HillshadeNormalMapGenerator {
    if (!this.normalMapGenerator) {
      const renderer = viewContext.getRenderer();
      this.normalMapGenerator = new HillshadeNormalMapGenerator(renderer);
    }
    return this.normalMapGenerator;
  }

  /**
   * Get hillshade decoder config from tile
   * Caches the result after first query to avoid repeated WASM calls
   * @param tileHandler - TileHandler to query WASM
   * @param tileHandle - Tile handle to get elevation decoder from
   */
  getHillshadeConfig(
    tileHandler: TileHandler,
    tileHandle: bigint,
  ): HillshadeConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Query elevation decoder from WASM for this tile
    const decoder = tileHandler.getTileElevationDecoder(tileHandle);

    if (decoder) {
      this.cachedConfig = {
        rgbScaler: [decoder.r_scaler, decoder.g_scaler, decoder.b_scaler],
        boundary: decoder.boundary,
        minOffset: decoder.min_offset,
        maxOffset: decoder.max_offset,
        epsilon: decoder.epsilon,
        offset: decoder.offset,
      };
      return this.cachedConfig;
    }

    // Fallback to Terrarium defaults if no decoder found
    this.cachedConfig = {
      rgbScaler: [256, 1, 1 / 256],
      boundary: 0,
      minOffset: 0,
      maxOffset: 0,
      epsilon: 1.0,
      offset: -32768,
    };
    return this.cachedConfig;
  }

  /**
   * Store a temporary DEM texture
   * Will be cleaned up when all 4 edges are received
   */
  storeTempDem(
    entityId: string,
    demTexture: DataTexture,
    metersPerTexel: number,
    hillshadeConfig: HillshadeConfig,
  ): void {
    // Clear any existing entry
    this.clearTempDem(entityId);

    this.tempDemTextures.set(entityId, {
      demTexture,
      receivedEdges: new Set(),
      metersPerTexel,
      hillshadeConfig,
    });
  }

  /**
   * Get temporary DEM texture entry
   */
  getTempDem(entityId: string): TempDemEntry | undefined {
    return this.tempDemTextures.get(entityId);
  }

  /**
   * Mark an edge as received for a temporary DEM
   * @returns true if all 4 edges have been received
   */
  markEdgeReceived(entityId: string, edgeDirection: number): boolean {
    const entry = this.tempDemTextures.get(entityId);
    if (!entry) return false;

    entry.receivedEdges.add(edgeDirection);
    return entry.receivedEdges.size >= 4; // All 4 edges received
  }

  /**
   * Clear temporary DEM texture
   */
  clearTempDem(entityId: string): void {
    const entry = this.tempDemTextures.get(entityId);
    if (entry) {
      entry.demTexture.dispose();
      this.tempDemTextures.delete(entityId);
    }
  }

  /**
   * Cleanup all resources
   * Should be called on view disposal
   */
  dispose(): void {
    // Clear all temporary DEM textures
    for (const [entityId] of this.tempDemTextures) {
      this.clearTempDem(entityId);
    }

    // Clear pending edges
    this.pendingEdges.clear();

    // Dispose generator
    if (this.normalMapGenerator) {
      this.normalMapGenerator.dispose();
      this.normalMapGenerator = null;
    }
  }
}
