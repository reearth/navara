import { EventHandler, Observed, type XYZ } from "@navara/core";
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
import invariant from "tiny-invariant";

import { ATMOSPHERE_ASSETS_URL, STBN_URL } from "./constants";

/**
 * Events emitted by the {@link Atmosphere} class.
 */
export type AtmosphereEvents = {
  /** Emitted when the atmosphere needs to trigger a re-render. */
  needsUpdate: () => void;
  /** Emitted when precomputed atmosphere textures have been loaded. */
  textureLoaded: () => void;
  /** Emitted when the atmosphere is disposed. */
  disposed: () => void;
  /** Emitted when the sun direction changes. */
  sunChanged: (sunDirection: Vector3) => void;
};

/**
 * Configuration options for the {@link Atmosphere} class.
 */
export type AtmosphereOptions = {
  /** URL to load precomputed atmosphere textures from. */
  atmosphereAssetsUrl?: string;
  /** URL to load STBN (Spatio-Temporal Blue Noise) textures from. */
  stbnUrl?: string;
  /** Date used for calculating sun/moon positions. Defaults to current date. */
  date?: Date;
};

/**
 * Default values for {@link AtmosphereOptions}.
 */
export const DEFAULT_ATMOSPHERE_OPTIONS: Required<AtmosphereOptions> = {
  atmosphereAssetsUrl: ATMOSPHERE_ASSETS_URL,
  stbnUrl: STBN_URL,
  date: new Date(),
};

/**
 * Context for atmosphere rendering.
 *
 * Manages sun/moon positions, precomputed atmosphere textures, and related state.
 * Some variables are shared with Clouds and AerialPerspective.
 */
export class Atmosphere extends EventHandler<AtmosphereEvents> {
  /**
   * @private
   */
  private renderer: WebGLRenderer;

  /**
   * Current sun direction in ECEF coordinates.
   */
  sunDirection = new Vector3();

  /**
   * Current moon direction in ECEF coordinates.
   */
  moonDirection = new Vector3();

  /**
   * @private
   */
  private rotationMatrix = new Matrix4();

  /**
   * Precomputed atmosphere textures used for rendering.
   * Loaded asynchronously via {@link initTextures}.
   */
  textures?: PrecomputedTextures;

  // Variables that come from Clouds.
  overlay = new Observed<AtmosphereOverlay | null>(null);
  shadow = new Observed<AtmosphereShadow | null>(null);
  shadowLength = new Observed<AtmosphereShadowLength | null>(null);
  enableShadows = new Observed<boolean>(true);

  /**
   * @private
   */
  private needsUpdate = false;

  /**
   * @private
   */
  private options: AtmosphereOptions;

  /**
   * Creates a new Atmosphere instance.
   * @param renderer - The WebGL renderer used for texture type detection.
   * @param options - Configuration options for the atmosphere.
   */
  constructor(renderer: WebGLRenderer, options: AtmosphereOptions = {}) {
    super();

    this.renderer = renderer;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };

    this.onUpdate();
  }

  /**
   * Marks the atmosphere as needing an update.
   * @private
   */
  onUpdate = () => {
    this.needsUpdate = true;
    this.emit("needsUpdate");
  };

  /**
   * Loads precomputed atmosphere textures asynchronously.
   * If textures are already loaded, this method returns immediately.
   * @returns A promise that resolves when textures are loaded.
   */
  // TODO: Add an option to disable loading textures.
  async initTextures() {
    if (this.textures) return;

    this.textures = await new PrecomputedTexturesLoader()
      .setType(this.renderer)
      .loadAsync(
        this.options.atmosphereAssetsUrl ??
          DEFAULT_ATMOSPHERE_OPTIONS.atmosphereAssetsUrl,
      );

    this.emit("textureLoaded");
  }

  /**
   * @private
   */
  async _init() {
    await this.initTextures();
  }

  /**
   * @private
   */
  _dispose() {
    this.emit("disposed");
  }

  /**
   * Invokes the callback with precomputed textures immediately if already loaded,
   * or registers a one-time listener to invoke it once textures are ready.
   */
  onTexturesReady(callback: (textures: PrecomputedTextures) => void): void {
    if (this.textures) {
      callback(this.textures);
    } else {
      this.once("textureLoaded", () => {
        invariant(this.textures);
        callback(this.textures);
      });
    }
  }

  /**
   * Returns a clone of the current sun direction vector.
   * @returns A new Vector3 representing the sun direction in ECEF coordinates.
   */
  getSunDirection(): Vector3 {
    return this.sunDirection.clone();
  }

  /**
   * Returns a clone of the current moon direction vector.
   * @returns A new Vector3 representing the moon direction in ECEF coordinates.
   */
  getMoonDirection(): Vector3 {
    return this.moonDirection.clone();
  }

  /**
   * Returns a clone of the ECI to ECEF rotation matrix.
   * @returns A new Matrix4 representing the rotation from ECI to ECEF coordinates.
   */
  getRotationMatrix(): Matrix4 {
    return this.rotationMatrix.clone();
  }

  /**
   * Updates sun/moon directions and rotation matrix if needed.
   * @private
   */
  _update() {
    if (this.needsUpdate) {
      getSunDirectionECEF(this.date, this.sunDirection);
      getMoonDirectionECEF(this.date, this.moonDirection);
      getECIToECEFRotationMatrix(this.date, this.rotationMatrix);

      this.emit("sunChanged", this.sunDirection.clone());
    }

    this.needsUpdate = false;
  }

  /**
   * Determines whether a given position is on the night side of the Earth.
   * @param position - The position in ECEF coordinates to check.
   * @returns `true` if the position is on the night side, `false` otherwise.
   */
  isAtNight(position: XYZ): boolean {
    const normalizedPosition = new Vector3(position.x, position.y, position.z)
      .clone()
      .normalize();
    const dotProduct = normalizedPosition.dot(this.sunDirection);
    return dotProduct < 0;
  }

  /**
   * Gets the current date used for calculating sun/moon positions.
   */
  get date() {
    return this.options.date ?? DEFAULT_ATMOSPHERE_OPTIONS.date;
  }

  /**
   * Sets the date used for calculating sun/moon positions.
   * Triggers an update to recalculate celestial body directions.
   */
  set date(v: Date) {
    this.options.date = v;
    this.onUpdate();
  }
}
