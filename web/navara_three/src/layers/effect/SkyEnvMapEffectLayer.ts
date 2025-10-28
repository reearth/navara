import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { SkyEnvMapPass } from "../../passes";

type LayerDescription = {
  skyEnvMap?: {
    resolution?: number;
  };
};

export type SkyEnvMapPassConfig = LayerDescription & EffectLayerConfig;

export type SkyEnvMapPassUpdate = LayerDescription & EffectLayerUpdate;

export class SkyEnvMapEffectLayer extends EffectLayerDeclaration<
  SkyEnvMapPassConfig,
  SkyEnvMapPassUpdate,
  SkyEnvMapPass
> {
  static key = "skyEnvMap";
  static insertBefore = ["mrt"];

  private config: SkyEnvMapPassConfig;

  constructor(view: ViewContext, config: SkyEnvMapPassConfig) {
    super(view, config);
    this.config = config;
  }

  createPass(): SkyEnvMapPass {
    const scenes = this.view.scenes;
    const camera = this.view.camera;

    const resolution = this.config.skyEnvMap?.resolution ?? 256;

    const pass = new SkyEnvMapPass(scenes, camera, resolution);

    return pass;
  }

  onUpdateConfig(updates: SkyEnvMapPassUpdate): void {
    super.onUpdateConfig(updates);

    if (!this._instance) return;

    Object.assign(this.config, updates);

    if (updates.skyEnvMap?.resolution !== undefined) {
      // Would need to recreate the pass to change resolution
      // For now, resolution is set at creation time only
    }
  }
}
