import {
  MeshDeclaration,
  type MeshConfig,
  ViewContext,
  type MeshUpdate,
} from "@navara/three";

import { Stars, type StarsOptions } from "./stars";

type LayerDescription = {
  stars?: Partial<StarsOptions> & {
    assetsUrl?: string;
  };
};

export type StarsConfig = MeshConfig & LayerDescription;

export type StarsUpdate = MeshUpdate & LayerDescription;

export class StarsDeclaration extends MeshDeclaration<
  StarsConfig,
  StarsUpdate,
  Stars
> {
  private config: StarsConfig;
  private _stars: Stars | null = null;

  constructor(view: ViewContext, config: StarsConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "transparent" {
    return "opaque";
  }

  createMesh() {
    // Create a placeholder that will be replaced when the async loading completes
    const starsOptions: StarsOptions = this.config.stars ?? {};

    // Start async loading and replace when ready
    const assetsUrl = this.config.stars?.assetsUrl;

    const stars = Stars.fromUrl(assetsUrl, starsOptions);
    this._stars = stars;

    this.view.atmosphere.onTexturesReady((t) => stars.setTextures(t));

    stars.on("needsUpdate", () => this.emit("needsUpdate"));

    return stars;
  }

  onUpdateConfig(updates: StarsUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.stars && updates.stars && this._stars) {
      Object.assign(this.config.stars, updates.stars);

      // Update individual properties
      if (updates.stars.pointSize !== undefined) {
        this._stars.pointSize = updates.stars.pointSize;
      }
      if (updates.stars.intensity !== undefined) {
        this._stars.intensity = updates.stars.intensity;
      }
      if (updates.stars.background !== undefined) {
        this._stars.background = updates.stars.background;
      }
    }
  }

  update(_time: number): void {
    if (this._stars) {
      // Update sun direction and rotation from atmosphere
      this._stars.updateSunDirection(this.view.atmosphere.getSunDirection());
      this._stars.setRotationFromMatrix(
        this.view.atmosphere.getRotationMatrix(),
      );
    }
  }

  protected disposeMesh(): void {
    if (this._stars) {
      // Stars class doesn't have a dispose method, but cleanup will be handled externally
      this._stars = null;
    }
    if (this._instance) {
      this._instance = undefined;
    }
  }

  getStars(): Stars | null {
    return this._stars;
  }
}
