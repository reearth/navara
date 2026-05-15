import type { DataTexture, Texture } from "three";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
} from "three";

import type { ViewContext } from "../core";
import { HillshadeNormalMapGenerator } from "../utils/hillshadeNormalMapGenerator";

import type { TileHandler } from "./context";

/**
 * Hillshade decoder configuration from Rust
 */
export type HillshadeConfig = {
  rgbScaler: [number, number, number]; // vec3: [R, G, B] scalers
  boundary: number;
  minOffset: number;
  maxOffset: number;
  epsilon: number;
  offset: number;
};

/**
 * Temporary DEM texture storage entry
 * Kept until all 4 edges arrive (directions: 0=Left, 1=Right, 2=Top, 3=Bottom)
 */
type TempDemEntry = {
  demTexture: DataTexture;
  receivedEdges: Set<number>;
  metersPerTexel: number;
  hillshadeConfig: HillshadeConfig;
};

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
   * entityId → { demTexture, receivedEdges, metersPerTexel, hillshadeConfig }
   */
  readonly tempDemTextures = new Map<string, TempDemEntry>();

  /**
   * RenderTarget pool for normal map generation
   * One RenderTarget per entity to avoid GPU→CPU→GPU round-trip
   * Similar to texturizedSceneRenderTargets in tile.ts
   */
  private renderTargets = new Map<string, WebGLRenderTarget>();

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
    const decoder = tileHandler.getTileElevationDecoder(tileHandle);

    if (decoder) {
      return {
        rgbScaler: [decoder.r_scaler, decoder.g_scaler, decoder.b_scaler],
        boundary: decoder.boundary,
        minOffset: decoder.min_offset,
        maxOffset: decoder.max_offset,
        epsilon: decoder.epsilon,
        offset: decoder.offset,
      };
    } else {
      // Fallback to Terrarium defaults if no decoder found
      return {
        rgbScaler: [256, 1, 1 / 256],
        boundary: 0,
        minOffset: 0,
        maxOffset: 0,
        epsilon: 1.0,
        offset: -32768,
      };
    }
  }

  /**
   * Get or create a RenderTarget for the given entity
   * Reuses existing RenderTarget if size matches, creates new one otherwise
   * @private
   */
  private getOrCreateRenderTarget(
    entityId: string,
    width: number,
    height: number,
  ): WebGLRenderTarget {
    let rt = this.renderTargets.get(entityId);

    // Check if size matches (different zoom levels may have different sizes)
    if (rt && (rt.width !== width || rt.height !== height)) {
      rt.dispose();
      rt = undefined;
    }

    if (!rt) {
      rt = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        type: UnsignedByteType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        wrapS: ClampToEdgeWrapping,
        wrapT: ClampToEdgeWrapping,
        colorSpace: NoColorSpace,
        generateMipmaps: false, // Disable mipmaps for normal maps
      });
      this.renderTargets.set(entityId, rt);
    }

    return rt;
  }

  /**
   * Generate normal map texture from DEM texture
   * Uses RenderTarget pool to avoid GPU→CPU→GPU round-trip
   * @param entityId - Entity ID for RenderTarget lookup/creation
   * @param viewContext - ViewContext to get the renderer from
   * @param demTexture - Source DEM texture (padded)
   * @param metersPerTexel - Meters per texel for normal calculation
   * @param hillshadeConfig - Hillshade decoder configuration
   * @param tileCoords - Optional tile coordinates for debugging (z/x/y format)
   * @returns Normal map texture (references RenderTarget.texture directly)
   */
  generateNormalMap(
    entityId: string,
    viewContext: ViewContext,
    demTexture: DataTexture,
    metersPerTexel: number,
    hillshadeConfig: HillshadeConfig,
  ): Texture {
    const paddedWidth = demTexture.image.width;
    const paddedHeight = demTexture.image.height;

    // Calculate content size (remove padding)
    const isPowerOfTwo = (n: number) => (n & (n - 1)) === 0 && n !== 0;
    const contentWidth = isPowerOfTwo(paddedWidth)
      ? paddedWidth
      : paddedWidth - 2;
    const contentHeight = isPowerOfTwo(paddedHeight)
      ? paddedHeight
      : paddedHeight - 2;

    // Get or create RenderTarget for this entity
    const renderTarget = this.getOrCreateRenderTarget(
      entityId,
      contentWidth,
      contentHeight,
    );

    // Get generator and render to target
    const generator = this.getOrCreateGenerator(viewContext);
    generator.renderToTarget(
      renderTarget,
      demTexture,
      metersPerTexel,
      hillshadeConfig,
    );

    // Return the texture directly
    return renderTarget.texture;
  }

  /**
   * Clear RenderTarget for the given entity
   */
  clearRenderTarget(entityId: string): void {
    const rt = this.renderTargets.get(entityId);
    if (rt) {
      rt.dispose();
      this.renderTargets.delete(entityId);
    }
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

    // Dispose all RenderTargets
    for (const rt of this.renderTargets.values()) {
      rt.dispose();
    }
    this.renderTargets.clear();

    // Dispose generator
    if (this.normalMapGenerator) {
      this.normalMapGenerator.dispose();
      this.normalMapGenerator = null;
    }
  }
}
