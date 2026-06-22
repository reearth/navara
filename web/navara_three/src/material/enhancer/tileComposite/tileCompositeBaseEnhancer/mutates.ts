import { Color, Uniform, Vector2, type Texture } from "three";

import type { CompositeLayer } from "../../../../tileTexture/types";

/** Shader uniform dictionary the composite ShaderMaterial is built from. */
export type CompositeUniformTarget = Record<string, Uniform>;

const WHITE = new Color(1, 1, 1);

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
      target.uShows = refs.uShows;
      target.uOpacities = refs.uOpacities;
      target.uColors = refs.uColors;
      target.uTextures = refs.uTextures;
      target.uLayerUvOffset = refs.uLayerUvOffset;
      target.uLayerUvScale = refs.uLayerUvScale;
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
    },
  };
}
