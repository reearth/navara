import { EventHandler, Observed } from "@navara/core";
import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECEF,
  getSunDirectionECEF,
  PrecomputedTexturesLoader,
  type AtmosphereOverlay,
  type AtmosphereShadow,
  type AtmosphereShadowLength,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { Vector3, Matrix4, type WebGLRenderer } from "three";

import { ATMOSPHERE_ASSETS_URL, STBN_URL } from "./constants";

export type AtmosphereEvents = {
  _needsUpdate: () => void;
  _textureLoaded: () => void;
  _disposed: () => void;
};

export type AtmosphereOptions = {
  atmosphereAssetsUrl?: string;
  stbnUrl?: string;
  date?: Date;
};

export const DEFAULT_ATMOSPHERE_OPTIONS: Required<AtmosphereOptions> = {
  atmosphereAssetsUrl: ATMOSPHERE_ASSETS_URL,
  stbnUrl: STBN_URL,
  date: new Date(),
};

/**
 * Context for atmosphere.
 * Some variables are shared with Clouds and AerialPerspective.
 */
export class Atmosphere extends EventHandler<AtmosphereEvents> {
  private renderer: WebGLRenderer;

  sunDirection = new Vector3();
  moonDirection = new Vector3();
  private rotationMatrix = new Matrix4();

  textures?: PrecomputedTextures;

  // Removed object management - these are now handled externally

  // Variables that come from Clouds.
  /**
   * @private
   */
  _overlay = new Observed<AtmosphereOverlay | null>(null);
  /**
   * @private
   */
  _shadow = new Observed<AtmosphereShadow | null>(null);
  /**
   * @private
   */
  _shadowLength = new Observed<AtmosphereShadowLength | null>(null);
  /**
   * @private
   */
  _enableShadows = new Observed<boolean>(true);

  private needsUpdate = false;

  private options: AtmosphereOptions;

  constructor(renderer: WebGLRenderer, options: AtmosphereOptions = {}) {
    super();

    this.renderer = renderer;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };

    this.onUpdate();
  }

  onUpdate = () => {
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  };

  // TODO: Add an option to disable loading textures.
  async initTextures() {
    if (this.textures) return;

    this.textures = await new PrecomputedTexturesLoader()
      .setType(this.renderer)
      .loadAsync(
        this.options.atmosphereAssetsUrl ??
          DEFAULT_ATMOSPHERE_OPTIONS.atmosphereAssetsUrl,
      );

    this.emit("_textureLoaded");
  }

  // Initialize textures for external objects to use
  async init() {
    await this.initTextures();
  }

  // Dispose the atmosphere context
  dispose() {
    this.emit("_disposed");
  }

  // Public method to get current sun direction for external objects
  getSunDirection(): Vector3 {
    return this.sunDirection.clone();
  }

  // Public method to get current moon direction for external objects
  getMoonDirection(): Vector3 {
    return this.moonDirection.clone();
  }

  // Public method to get rotation matrix for external objects
  getRotationMatrix(): Matrix4 {
    return this.rotationMatrix.clone();
  }

  _update() {
    if (this.needsUpdate) {
      getSunDirectionECEF(this.date, this.sunDirection);
      getMoonDirectionECEF(this.date, this.moonDirection);
      getECIToECEFRotationMatrix(this.date, this.rotationMatrix);
    }

    this.needsUpdate = false;
  }

  get date() {
    return this.options.date ?? DEFAULT_ATMOSPHERE_OPTIONS.date;
  }
  set date(v: Date) {
    this.options.date = v;
    this.onUpdate();
  }
}
