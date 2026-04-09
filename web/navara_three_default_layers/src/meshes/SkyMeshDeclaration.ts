import {
  MeshDeclaration,
  type MeshConfig,
  ViewContext,
  type MeshUpdate,
} from "@navara/three";

import { SkyMesh, type SkyMeshOptions } from "./skyMesh";

type LayerDescription = {
  sky?: Partial<SkyMeshOptions>;
};

export type SkyMeshConfig = MeshConfig & LayerDescription;

export type SkyMeshUpdate = MeshUpdate & LayerDescription;

export class SkyMeshDeclaration extends MeshDeclaration<
  SkyMeshConfig,
  SkyMeshUpdate,
  SkyMesh
> {
  private config: SkyMeshConfig;
  private _skyMesh: SkyMesh | null = null;

  constructor(view: ViewContext, config: SkyMeshConfig) {
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
    this.view.atmosphere.onTexturesReady((t) => skyMesh.setTextures(t));
    skyMesh.setShadowLengthHandler(this.view.atmosphere.shadowLength);

    skyMesh.on("needsUpdate", () => this.emit("needsUpdate"));

    return skyMesh;
  }

  onUpdateConfig(updates: SkyMeshUpdate): void {
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
      if (updates.sky.sunAngularRadius !== undefined) {
        this._skyMesh.sunAngularRadius = updates.sky.sunAngularRadius;
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
