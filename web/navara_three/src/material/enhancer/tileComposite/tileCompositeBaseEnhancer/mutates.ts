import { Color, Uniform, Vector2, Vector4, type Texture } from "three";

import type { CompositeLayer } from "../../../../tileTexture/types";

/** Shader uniform dictionary the composite ShaderMaterial is built from. */
export type CompositeUniformTarget = Record<string, Uniform>;

const WHITE = new Color(1, 1, 1);

/** atan(sinh(PI)) — the WebMercator max latitude (~85.051°). */
const WM_MAX_LAT = Math.atan(Math.sinh(Math.PI));

/**
 * Owns the core per-slot uniforms (shows/colors/opacities/textures/uv) of the
 * composite material. Refs live in this closure so binds mutate the same
 * objects three.js holds. Mirrors the MaterialEnhancer mutates pattern: create
 * + attach once, then sync per compact slot from the planned layers.
 */
export type CoreUniformMutates = {
  attachUniforms: (
    target: CompositeUniformTarget,
    numTextures: number,
    placeholder: Texture,
  ) => void;
  /** Sync slot `compactSlot` from the layer occupying it (or clear it). */
  bindSlot: (compactSlot: number, layer: CompositeLayer | undefined) => void;
};

export function createCoreUniformMutates(): CoreUniformMutates {
  const refs = {
    uShows: new Uniform<number[]>([]),
    uOpacities: new Uniform<number[]>([]),
    uColors: new Uniform<Color[]>([]),
    uTextures: new Uniform<Texture[]>([]),
    uLayerUvOffset: new Uniform<Vector2[]>([]),
    uLayerUvScale: new Uniform<Vector2[]>([]),
    // Per-slot Mercator reprojection: uReproject[k] = 1 means sample this slot's
    // texture using the latitude reprojection driven by uReprojectTerrainLat[k]
    // (the terrain tile's [south, north] latitude in radians).
    uReproject: new Uniform<number[]>([]),
    uReprojectTerrainLat: new Uniform<Vector2[]>([]),
    // CPU-precomputed per-slot reprojection constants consumed by the shader:
    //   (mRs, mDen, clampTopEdge, clampBottomEdge). See bindSlot for the math.
    uReprojectMerc: new Uniform<Vector4[]>([]),
  };
  let placeholderTexture: Texture | null = null;

  return {
    attachUniforms: (target, numTextures, placeholder) => {
      placeholderTexture = placeholder;
      refs.uShows.value = new Array<number>(numTextures).fill(0);
      refs.uOpacities.value = new Array<number>(numTextures).fill(1);
      refs.uColors.value = Array.from(
        { length: numTextures },
        () => new Color(),
      );
      refs.uTextures.value = new Array<Texture>(numTextures).fill(placeholder);
      refs.uLayerUvOffset.value = Array.from(
        { length: numTextures },
        () => new Vector2(0, 0),
      );
      refs.uLayerUvScale.value = Array.from(
        { length: numTextures },
        () => new Vector2(1, 1),
      );
      refs.uReproject.value = new Array<number>(numTextures).fill(0);
      refs.uReprojectTerrainLat.value = Array.from(
        { length: numTextures },
        () => new Vector2(0, 0),
      );
      refs.uReprojectMerc.value = Array.from(
        { length: numTextures },
        () => new Vector4(0, 0, 0, 0),
      );
      target.uShows = refs.uShows;
      target.uOpacities = refs.uOpacities;
      target.uColors = refs.uColors;
      target.uTextures = refs.uTextures;
      target.uLayerUvOffset = refs.uLayerUvOffset;
      target.uLayerUvScale = refs.uLayerUvScale;
      target.uReproject = refs.uReproject;
      target.uReprojectTerrainLat = refs.uReprojectTerrainLat;
      target.uReprojectMerc = refs.uReprojectMerc;
    },

    bindSlot: (k, layer) => {
      refs.uShows.value[k] = layer ? 1 : 0;
      refs.uTextures.value[k] =
        layer?.texture ?? placeholderTexture ?? refs.uTextures.value[k];
      // Color only matters for raster slots; hillshade is zeroed and elevation
      // reads the colormap, so reset others to white to drop stale values.
      if (layer && layer.kind === "raster") {
        refs.uColors.value[k].copy(layer.color);
      } else {
        refs.uColors.value[k].copy(WHITE);
      }
      refs.uOpacities.value[k] =
        layer && "opacity" in layer ? layer.opacity : 1;
      if (layer) {
        refs.uLayerUvOffset.value[k].copy(layer.uvOffset);
        refs.uLayerUvScale.value[k].copy(layer.uvScale);
      } else {
        refs.uLayerUvOffset.value[k].set(0, 0);
        refs.uLayerUvScale.value[k].set(1, 1);
      }

      // Reproject applies to color rasters and elevation heatmaps alike — the
      // shader warps the per-slot UV before either sampler runs; hillshade is
      // terrain-side and never reprojects.
      const reproject =
        layer && (layer.kind === "raster" || layer.kind === "elevationHeatmap")
          ? layer.reproject
          : undefined;
      if (reproject && layer) {
        const [Ts, Tn] = reproject;
        // Recover the source tile's latitude band [Rs, Rn] from the affine y
        // mapping, then its Mercator-space start (mRs) and span (mDen). These are
        // constant per slot, so the shader reads them instead of evaluating
        // log/tan per fragment — only the shared per-fragment mLat stays on GPU.
        const span = (Tn - Ts) / layer.uvScale.y;
        const Rs = Ts - layer.uvOffset.y * span;
        const Rn = Rs + span;
        const mRs = Math.log(Math.tan(Math.PI * 0.25 + Rs * 0.5));
        const mRn = Math.log(Math.tan(Math.PI * 0.25 + Rn * 0.5));
        // Polar cap: clamp the overshoot onto the band-edge texel when this tile's
        // north/south edge sits on the WebMercator latitude limit.
        const clampTop = Rn >= WM_MAX_LAT - 1e-4 ? 1 : 0;
        const clampBottom = Rs <= -WM_MAX_LAT + 1e-4 ? 1 : 0;
        refs.uReproject.value[k] = 1;
        refs.uReprojectTerrainLat.value[k].set(Ts, Tn);
        refs.uReprojectMerc.value[k].set(mRs, mRn - mRs, clampTop, clampBottom);
      } else {
        refs.uReproject.value[k] = 0;
      }
    },
  };
}
