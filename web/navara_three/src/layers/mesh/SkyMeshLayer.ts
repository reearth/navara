import invariant from "tiny-invariant";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  ViewContext,
  type MeshLayerUpdate,
} from "../../core";
import { SkyMesh, type SkyMeshOptions } from "../../mesh";

type LayerDescription = {
  sky?: Partial<SkyMeshOptions>;
};

export type SkyMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SkyMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class SkyMeshLayer extends MeshLayerDeclaration<
  SkyMeshLayerConfig,
  SkyMeshLayerUpdate,
  SkyMesh
> {
  private config: SkyMeshLayerConfig;
  private _skyMesh: SkyMesh | null = null;

  constructor(view: ViewContext, config: SkyMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  getPassKey(): "opaque" | "skyEnvMap" {
    if (this.config.sky?.envMap) {
      return "skyEnvMap";
    }
    return "opaque";
  }

  createMesh() {
    const skyOptions: SkyMeshOptions = this.config.sky ?? {};

    const skyMesh = new SkyMesh(skyOptions);
    this._skyMesh = skyMesh;

    // Set up atmosphere integration
    if (this.view.atmosphere.textures) {
      skyMesh.setTextures(this.view.atmosphere.textures);
    } else {
      const textureLoaded = () => {
        invariant(this.view.atmosphere.textures);
        skyMesh.setTextures(this.view.atmosphere.textures);
      };
      this.view.atmosphere.on("_textureLoaded", textureLoaded);
    }
    skyMesh.setShadowLengthHandler(this.view.atmosphere._shadowLength);

    skyMesh.on("_needsUpdate", () => this.emit("_needsUpdate"));

    return skyMesh;
  }

  onUpdateConfig(updates: SkyMeshLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.sky && updates.sky && this._skyMesh) {
      Object.assign(this.config.sky, updates.sky);

      if (updates.sky.envMap !== undefined) {
        this.config.sky.envMap = updates.sky.envMap;
        this.onPassKeyChange();
      }

      // Update individual properties
      if (updates.sky.sun !== undefined) {
        this._skyMesh.sun = updates.sky.sun;
      }
      if (updates.sky.moon !== undefined) {
        this._skyMesh.moon = updates.sky.moon;
      }
      if (updates.sky.moonScale !== undefined) {
        this._skyMesh.moonScale = updates.sky.moonScale;
      }
      if (updates.sky.moonIntensity !== undefined) {
        this._skyMesh.moonIntensity = updates.sky.moonIntensity;
      }
    }
  }

  update(_time: number): void {
    if (this._skyMesh) {
      // Update sun and moon directions from atmosphere
      this._skyMesh.updateSunDirection(this.view.atmosphere.getSunDirection());
      this._skyMesh.updateMoonDirection(
        this.view.atmosphere.getMoonDirection(),
      );
    }
  }

  protected disposeMesh(): void {
    if (this._skyMesh) {
      this._skyMesh.dispose();
      this._skyMesh = null;
    }
    if (this._instance) {
      this._instance = undefined;
    }
  }

  getSkyMesh(): SkyMesh | null {
    return this._skyMesh;
  }
}
