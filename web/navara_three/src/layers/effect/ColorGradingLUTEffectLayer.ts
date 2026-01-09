import { LookupTexture, RawImageData } from "postprocessing";
import { TextureLoader } from "three";
import { LUT3dlLoader } from "three/examples/jsm/loaders/LUT3dlLoader.js";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";

import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { ColorGradingLUT, type ColorGradingLUTOptions } from "../../effects";

type LayerDescription = {
  colorGradingLUT?: ColorGradingLUTOptions & { url?: string };
};

export const DEFAULT_COLOR_GRADING_LUT_OPTIONS = {
  url: "",
  blendMode: "src" as const,
  opacity: 1.0,
};

export type ColorGradingLUTConfig = LayerDescription & EffectLayerConfig;

export type ColorGradingLUTUpdate = LayerDescription & EffectLayerUpdate;

export class ColorGradingLUTEffectLayer extends EffectLayerDeclaration<
  ColorGradingLUTConfig,
  ColorGradingLUTUpdate,
  ColorGradingLUT
> {
  static key = "colorGradingLUT";
  static insertBefore = ["smaa", "fxaa", "final"];

  private config: ColorGradingLUTConfig;

  private static lutCubeLoader: LUTCubeLoader | undefined;
  private static lut3dlLoader: LUT3dlLoader | undefined;
  private static textureLoader: TextureLoader | undefined;

  constructor(view: ViewContext, config: ColorGradingLUTConfig) {
    super(view, config);
    this.config = config;
  }

  private loadLUT(url: string, pass: ColorGradingLUT) {
    if (url.length === 0) return;

    const extension = url.split(".").pop()?.toLowerCase();

    if (extension === "cube") {
      if (!ColorGradingLUTEffectLayer.lutCubeLoader) {
        ColorGradingLUTEffectLayer.lutCubeLoader = new LUTCubeLoader();
      }
      ColorGradingLUTEffectLayer.lutCubeLoader.load(
        url,
        (t) => {
          const lut = new LookupTexture(t.texture3D.image.data, t.size);
          lut.type = t.texture3D.type;
          lut.colorSpace = t.texture3D.colorSpace;
          lut.generateMipmaps = false;

          pass.lut = lut;
          t.texture3D.dispose();
          this.emit("_needsUpdate");
        },
        undefined,
        (err) => {
          console.error(`Failed to load LUT from ${url}:`, err);
        },
      );
    } else if (extension === "3dl") {
      if (!ColorGradingLUTEffectLayer.lut3dlLoader) {
        ColorGradingLUTEffectLayer.lut3dlLoader = new LUT3dlLoader();
      }
      ColorGradingLUTEffectLayer.lut3dlLoader.load(
        url,
        (t) => {
          const lut = new LookupTexture(t.texture3D.image.data, t.size);
          lut.type = t.texture3D.type;
          lut.colorSpace = t.texture3D.colorSpace;
          lut.generateMipmaps = false;

          pass.lut = lut;
          t.texture3D.dispose();
          this.emit("_needsUpdate");
        },
        undefined,
        (err) => {
          console.error(`Failed to load LUT from ${url}:`, err);
        },
      );
    } else if (
      extension === "png" ||
      extension === "jpg" ||
      extension === "jpeg"
    ) {
      if (!ColorGradingLUTEffectLayer.textureLoader) {
        ColorGradingLUTEffectLayer.textureLoader = new TextureLoader();
      }
      ColorGradingLUTEffectLayer.textureLoader.load(
        url,
        (t) => {
          const { width, height } = t.image;
          // LUT size is cube root of pixel count
          // Image pixels = N^3 (one pixel per LUT entry)
          // Image is square, so: width * height = width^2 = N^3
          const size = Math.cbrt(width * height);

          // lut size must be integer to be valid
          if (Number.isInteger(size) === false) {
            console.error(`Invalid LUT texture size: ${width}x${height}`);
            return;
          }

          const { data } = RawImageData.from(t.image);

          const lut = new LookupTexture(data, size);
          lut.type = t.type;
          lut.colorSpace = t.colorSpace;
          lut.generateMipmaps = false;

          pass.lut = lut;
          t.dispose();
          this.emit("_needsUpdate");
        },
        undefined,
        (err) => {
          console.error(`Failed to load LUT from ${url}:`, err);
        },
      );
    } else {
      console.warn(`Unsupported LUT file format: ${extension}`);
      return;
    }
  }

  createPass() {
    const pass = new ColorGradingLUT(
      this.view.camera,
      LookupTexture.createNeutral(8),
      {
        ...this.config.colorGradingLUT,
        enabled: this.config.visible ?? true,
      },
    );

    this.loadLUT(this.config.colorGradingLUT?.url || "", pass);

    return pass;
  }

  onUpdateConfig(updates: ColorGradingLUTUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.colorGradingLUT;
    if (!config) return;

    if (config.url !== undefined) {
      this.loadLUT(config.url, this._instance);
    }

    if (config.blendMode !== undefined) {
      this._instance.blendMode = config.blendMode;
    }

    if (config.opacity !== undefined) {
      this._instance.opacity = config.opacity;
    }
  }
}
