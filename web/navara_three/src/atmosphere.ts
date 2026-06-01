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

import { type ThreeViewCamera } from "./camera";
import { ATMOSPHERE_ASSETS_URL, STBN_URL } from "./constants";
import { shiftDateToElevation, shiftDateToHourAngle } from "./solar";

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
   * @private
   */
  private _camera: ThreeViewCamera | undefined;

  /**
   * Creates a new Atmosphere instance.
   * @param renderer - The WebGL renderer used for texture type detection.
   * @param options - Configuration options for the atmosphere.
   * @param camera - Camera reference used by {@link setDateAt}.
   */
  constructor(
    renderer: WebGLRenderer,
    options: AtmosphereOptions = {},
    camera?: ThreeViewCamera,
  ) {
    super();

    this.renderer = renderer;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };
    this._camera = camera;

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
    if (this.textures) {
      this.textures.irradianceTexture.dispose();
      this.textures.scatteringTexture.dispose();
      this.textures.transmittanceTexture.dispose();
      this.textures.singleMieScatteringTexture?.dispose();
      this.textures.higherOrderScatteringTexture?.dispose();
      this.textures = undefined;
    }
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

  /**
   * Adjusts `atmosphere.date` so that the local solar time at `to` matches the
   * local solar time at `from`.
   *
   * The calculation is based on the sun's hour angle, which increases
   * monotonically over a solar day, giving exactly one solution per day with no
   * morning/afternoon ambiguity. The equation of time is accounted for
   * automatically.
   *
   * @example
   * // atmosphere.date shows 08:00 local solar time at Tokyo.
   * view.atmosphere.setDateAt({ lng: 139.69 }, { lng: 0 });
   * // → atmosphere.date is now 08:00 local solar time at London
   *
   * @param from - Source location. Only `lng` (degrees) affects the result.
   * @param to   - Target location. Only `lng` (degrees) affects the result.
   */
  setDateAt(
    from: { lng: number; lat?: number },
    to: { lng: number; lat?: number },
  ): void {
    this.date = shiftDateToHourAngle(this.date, from.lng, to.lng, to.lat);
  }

  /**
   * Adjusts `atmosphere.date` so that the sun elevation at `to` matches the
   * sun elevation at `from`.
   *
   * Morning/afternoon context is preserved. If the target elevation cannot be
   * reached at `to` (e.g. polar night), the date is clamped to solar noon
   * there.
   *
   * @example
   * // atmosphere.date shows sun at 30° elevation over Tokyo.
   * view.atmosphere.setElevationAt({ lat: 35.68, lng: 139.69 }, { lat: 51.5, lng: -0.12 });
   * // → atmosphere.date adjusted so sun is also at 30° elevation over London
   *
   * @param from - Source location (both `lat` and `lng` required).
   * @param to   - Target location (both `lat` and `lng` required).
   */
  setElevationAt(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): void {
    this.date = shiftDateToElevation(
      this.date,
      from.lat,
      from.lng,
      to.lat,
      to.lng,
    );
  }

  /**
   * Convenience wrapper for {@link setDateAt} that uses the camera position as
   * `from`.
   *
   * @example
   * // Camera is over Tokyo showing 08:00 local solar time.
   * view.atmosphere.setDateFromCameraAt({ lng: 0 }); // adjust to London
   * // → atmosphere.date is now 08:00 local solar time at London
   *
   * @param to - Target location. Only `lng` (degrees) affects the result.
   */
  setDateFromCameraAt(to: { lng: number; lat?: number }): void {
    const { lng: fromLng } = this._camera?.positionGeographic ?? { lng: 0 };
    this.setDateAt({ lng: fromLng }, to);
  }

  /**
   * Convenience wrapper for {@link setElevationAt} that uses the camera
   * position as `from`.
   *
   * @example
   * // Camera is over Tokyo with sun at 30° elevation.
   * view.atmosphere.setElevationFromCameraAt({ lat: 51.5, lng: -0.12 }); // adjust to London
   * // → atmosphere.date adjusted so sun is also at 30° elevation over London
   *
   * @param to - Target location (both `lat` and `lng` required).
   */
  setElevationFromCameraAt(to: { lat: number; lng: number }): void {
    const { lng: fromLng, lat: fromLat } = this._camera?.positionGeographic ?? {
      lng: 0,
      lat: 0,
    };
    this.setElevationAt({ lat: fromLat, lng: fromLng }, to);
  }
}
