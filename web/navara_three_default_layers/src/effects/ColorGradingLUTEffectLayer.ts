import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
  ColorGradingLUT,
  type ColorGradingLUTOptions,
} from "@navara/three";

type LayerDescription = {
  colorGradingLUT?: ColorGradingLUTOptions;
};

const DEFAULT_LUT_URL =
  "https://raw.githubusercontent.com/pmndrs/postprocessing/refs/heads/main/demo/static/textures/lut/3dl/presetpro-cinematic.3dl";

export const DEFAULT_COLOR_GRADING_LUT_OPTIONS = {
  url: DEFAULT_LUT_URL,
  blendMode: "colorBurn" as const,
  opacity: 0.78,
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

  constructor(view: ViewContext, config: ColorGradingLUTConfig) {
    super(view, config);
    this.config = config;
  }

  createPass() {
    const pass = new ColorGradingLUT(this.view.camera, {
      ...this.config.colorGradingLUT,
      enabled: this.config.visible ?? true,
    });

    // Listen for internal updates from the effect and propagate them
    pass.on("_needsUpdate", () => this.emit("_needsUpdate"));

    return pass;
  }

  onUpdateConfig(updates: ColorGradingLUTUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;
    Object.assign(this.config, updates);

    const config = updates.colorGradingLUT;
    if (!config) return;

    if (config.url !== undefined) {
      this._instance.url = config.url;
    }

    if (config.blendMode !== undefined) {
      this._instance.blendMode = config.blendMode;
    }

    if (config.opacity !== undefined) {
      this._instance.opacity = config.opacity;
    }
  }
}
