import { EventHandler } from "@navara/core";
import { CascadedShadowMaps, CSMHelper } from "@navara/three_csm";
import { SunDirectionalLight } from "@takram/three-atmosphere";
import { Color, Texture, Vector3, Material, PerspectiveCamera } from "three";

export type SunLightEvents = {
  _needsUpdate: () => void;
  _csmChanged: () => void;
};

export type ShadowMode = "uniform" | "logarithmic" | "practical";
export type ShadowQuality = "low" | "medium" | "high";

export type SunLightOptions = {
  distance?: number;
  color?: Color;
  applyColor?: boolean;
  intensity?: number;
  // Enhanced CSM shadow options
  castShadow?: boolean;
  shadowQuality?: ShadowQuality;
  // Advanced CSM options
  shadowCascadeCount?: number;
  shadowMapSize?: number;
  shadowFar?: number;
  shadowMode?: ShadowMode;
  shadowLambda?: number;
  shadowMargin?: number;
  shadowFade?: boolean;
  debugCSMHelper?: boolean;
};

const DEFAULT_SUN_LIGHT_OPTIONS: Required<SunLightOptions> = {
  distance: 300,
  color: new Color(0xffffff),
  applyColor: false,
  intensity: 1,
  castShadow: true,
  shadowMapSize: 2048,
  shadowQuality: "medium",
  shadowCascadeCount: 4,
  shadowFar: 5e4,
  shadowMode: "practical",
  shadowLambda: 0.5,
  shadowMargin: 5e4,
  shadowFade: true,
  debugCSMHelper: false,
};

export class SunLight extends EventHandler<SunLightEvents> {
  raw: SunDirectionalLight;
  private transmittanceTexture: Texture | null = null;
  private options: SunLightOptions;

  // CSM integration properties
  private csm!: CascadedShadowMaps;
  private csmHelper: CSMHelper | null = null;
  private camera: PerspectiveCamera;

  constructor(camera: PerspectiveCamera, options: SunLightOptions = {}) {
    super();

    this.camera = camera;
    this.options = { ...DEFAULT_SUN_LIGHT_OPTIONS, ...options };

    this.raw = new SunDirectionalLight({
      distance: this.options.distance,
    });

    this.initializeCSM();

    this.raw.intensity = this.intensity;
    this.raw.color.copy(this.color);

    this.castShadow = !!this.options.castShadow;
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.sunDirection.copy(sunDirection);
  }

  updateTargetPosition(position: Vector3) {
    if (this.applyColor) {
      return;
    }
    this.raw.target.position.copy(position);
  }

  update() {
    this.raw.update();

    // Sync CSM light direction with sun direction
    if (this.castShadow) {
      this.csm.directionalLights.direction.copy(this.raw.sunDirection.negate());

      if (!this.applyColor) {
        // Sync sun light color calculated dynamically.
        this.csm.directionalLights.cascadedLights.forEach((light) => {
          light.color.copy(this.color);
        });
      }
    }

    // Update CSM if enabled
    this.updateCSM();
  }

  setTransmittanceTexture(texture: Texture) {
    this.transmittanceTexture = texture;
    this.raw.transmittanceTexture = texture;
  }

  clearTransmittanceTexture() {
    this.raw.transmittanceTexture = null;
  }

  // Private CSM Lifecycle Methods

  /**
   * Initialize CSM with current options
   */
  private initializeCSM(): void {
    if (!this.camera) {
      return;
    }

    this.csm = new CascadedShadowMaps(this.camera, {
      cascadeCount: this.options.shadowCascadeCount,
      mapSize: this.options.shadowMapSize,
      far: this.options.shadowFar,
      mode: this.options.shadowMode,
      lambda: this.options.shadowLambda,
      margin: this.options.shadowMargin,
      fade: this.options.shadowFade,
    });

    // Set light direction to match sun direction
    this.csm.directionalLights.direction.copy(this.raw.sunDirection);

    // Set light properties to match current sun light
    this.csm.directionalLights.cascadedLights.forEach((light) => {
      light.intensity = this.intensity;
      light.color.copy(this.color);
    });

    // Setup CSM helper for debug visualization
    if (this.options.debugCSMHelper) {
      this.csmHelper = new CSMHelper(this.csm);
    }
  }

  /**
   * Update CSM (call this in render loop)
   */
  private updateCSM(): void {
    // Update CSM
    this.csm.update();

    // Update helper if visible
    if (this.csmHelper) {
      this.csmHelper.update();
    }
  }

  // CSM Integration Methods

  /**
   * Set the camera for CSM calculations
   */
  setCamera(camera: PerspectiveCamera): void {
    this.camera = camera;
  }

  /**
   * Setup a material for CSM
   */
  setupMaterialForCSM(material: Material): void {
    this.csm.setupMaterial(material);
  }

  /**
   * Remove a material from CSM
   */
  removeMaterialFromCSM(material: Material): void {
    this.csm.rollbackMaterial(material);
  }

  /**
   * Get CSM instance for advanced usage
   */
  getCSM(): CascadedShadowMaps {
    return this.csm;
  }

  /**
   * Get CSM helper for debug visualization
   */
  getCSMHelper(): CSMHelper | null {
    return this.csmHelper;
  }

  /**
   * Get the lights that should be added to the scene
   * Returns CSM lights if enabled, otherwise the standard sun light
   */
  getSceneLights() {
    if (this.castShadow) {
      return this.csm.directionalLights;
    }
    return this.raw;
  }

  /**
   * Get the helper that should be added to the scene for debug visualization
   */
  getSceneHelper() {
    return this.csmHelper;
  }

  get visible() {
    return this.raw.visible;
  }
  set visible(v: boolean) {
    this.raw.visible = v;
    this.emit("_needsUpdate");
  }

  get intensity() {
    return this.raw.intensity;
  }
  set intensity(v: number) {
    this.raw.intensity = v;
    this.csm.directionalLights.cascadedLights.forEach((light) => {
      light.intensity = this.intensity;
    });
    this.emit("_needsUpdate");
  }

  get color() {
    return this.raw.color;
  }
  set color(v: Color) {
    this.options.color = v;
    this.raw.color.copy(v);
    this.csm.directionalLights.cascadedLights.forEach((light) => {
      light.color.copy(this.color);
    });
    this.emit("_needsUpdate");
  }

  get applyColor() {
    return this.options.applyColor ?? DEFAULT_SUN_LIGHT_OPTIONS.applyColor;
  }
  set applyColor(v: boolean) {
    this.options.applyColor = v;
    this.raw.transmittanceTexture = v ? null : this.transmittanceTexture;
    if (v) {
      this.color = this.options.color ?? DEFAULT_SUN_LIGHT_OPTIONS.color;
    }
    this.emit("_needsUpdate");
  }

  get target() {
    return this.raw.target;
  }

  get castShadow() {
    return !!this.options.castShadow;
  }
  set castShadow(v: boolean) {
    this.options.castShadow = v;
    this.emit("_csmChanged");
    this.emit("_needsUpdate");
  }

  get shadowMapSize() {
    return (
      this.options.shadowMapSize ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMapSize
    );
  }
  set shadowMapSize(v: number) {
    this.options.shadowMapSize = v;

    this.emit("_needsUpdate");
  }

  get shadowFar() {
    return this.options.shadowFar ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowFar;
  }
  set shadowFar(v: number) {
    this.options.shadowFar = v;

    this.emit("_needsUpdate");
  }

  get shadowCascadeCount() {
    return (
      this.options.shadowCascadeCount ??
      DEFAULT_SUN_LIGHT_OPTIONS.shadowCascadeCount
    );
  }
  set shadowCascadeCount(v: number) {
    this.options.shadowCascadeCount = v;

    this.emit("_needsUpdate");
  }
  get shadowMode() {
    return this.options.shadowMode ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMode;
  }
  set shadowMode(v: ShadowMode) {
    this.options.shadowMode = v;

    this.emit("_needsUpdate");
  }
  get shadowLambda() {
    return this.options.shadowLambda ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowLambda;
  }
  set shadowLambda(v: number) {
    this.options.shadowLambda = v;

    this.emit("_needsUpdate");
  }
  get shadowMargin() {
    return this.options.shadowMargin ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMargin;
  }
  set shadowMargin(v: number) {
    this.options.shadowMargin = v;

    this.emit("_needsUpdate");
  }
  get shadowFade() {
    return this.options.shadowFade ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowFade;
  }
  set shadowFade(v: boolean) {
    this.options.shadowFade = v;

    this.emit("_needsUpdate");
  }
  get debugCSMHelper() {
    return (
      this.options.debugCSMHelper ?? DEFAULT_SUN_LIGHT_OPTIONS.debugCSMHelper
    );
  }
  set debugCSMHelper(v: boolean) {
    this.options.debugCSMHelper = v;

    this.emit("_needsUpdate");
  }
}
