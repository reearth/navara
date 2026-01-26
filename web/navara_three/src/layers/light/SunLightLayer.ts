import { Material } from "three";
import invariant from "tiny-invariant";

import { Color } from "../../Color";
import {
  LightLayerDeclaration,
  type LightLayerConfig,
  ViewContext,
  type LightLayerUpdate,
} from "../../core";
import { SunLight, type SunLightOptions } from "../../lights";

type LayerDescription = {
  /**
   * Sun light configuration options. Includes all CSM (Cascaded Shadow Maps) settings.
   * Color can be specified as a number (hex value) or Navara Color instance.
   */
  sun?: Omit<SunLightOptions, "color"> & { color?: Color };
};

export type SunLightLayerConfig = LightLayerConfig & LayerDescription;

export type SunLightLayerUpdate = LightLayerUpdate & LayerDescription;

export class SunLightLayer extends LightLayerDeclaration<
  SunLightLayerConfig,
  SunLightLayerUpdate,
  SunLight
> {
  private config: SunLightLayerConfig;

  constructor(view: ViewContext, config: SunLightLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createLight() {
    const options = this.config.sun ?? {};
    const color = options.color ? options.color.raw : undefined;

    const sunLight = new SunLight(this.view.camera, {
      ...options,
      ...(color ? { color } : {}),
    } as SunLightOptions);

    // Set up atmosphere integration
    if (this.view.atmosphere.textures) {
      sunLight.setTransmittanceTexture(
        this.view.atmosphere.textures.transmittanceTexture,
      );
    } else {
      const textureLoaded = () => {
        invariant(this.view.atmosphere.textures);
        sunLight.setTransmittanceTexture(
          this.view.atmosphere.textures.transmittanceTexture,
        );
      };
      this.view.atmosphere.on("_textureLoaded", textureLoaded);
    }

    sunLight.on("_needsUpdate", () => this.emit("_needsUpdate"));
    sunLight.on("_csmChanged", this.updateSceneLights.bind(this));

    return sunLight;
  }

  onUpdateConfig(updates: SunLightLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (this.config.sun && updates.sun && this._instance) {
      Object.assign(this.config.sun, updates.sun);

      // Update intensity
      if (updates.sun.intensity !== undefined) {
        this._instance.intensity = updates.sun.intensity;
      }

      // Update color
      if (updates.sun.color !== undefined) {
        this._instance.color = updates.sun.color.raw;
      }

      if (updates.sun.applyColor !== undefined) {
        this._instance.applyColor = updates.sun.applyColor;
      }

      // Shadow
      if (updates.sun.castShadow !== undefined) {
        this._instance.castShadow = updates.sun.castShadow;
      }
      if (updates.sun.shadowMapSize !== undefined) {
        this._instance.shadowMapSize = updates.sun.shadowMapSize;
      }
      if (updates.sun.shadowFar !== undefined) {
        this._instance.shadowFar = updates.sun.shadowFar;
      }
      if (updates.sun.shadowCascadeCount !== undefined) {
        this._instance.shadowCascadeCount = updates.sun.shadowCascadeCount;
      }
      if (updates.sun.shadowMode !== undefined) {
        this._instance.shadowMode = updates.sun.shadowMode;
      }
      if (updates.sun.shadowLambda !== undefined) {
        this._instance.shadowLambda = updates.sun.shadowLambda;
      }
      if (updates.sun.shadowMargin !== undefined) {
        this._instance.shadowMargin = updates.sun.shadowMargin;
      }
      if (updates.sun.shadowFade !== undefined) {
        this._instance.shadowFade = updates.sun.shadowFade;
      }
      if (updates.sun.shadowIntensity !== undefined) {
        this._instance.shadowIntensity = updates.sun.shadowIntensity;
      }
      if (updates.sun.shadowBias !== undefined) {
        this._instance.shadowBias = updates.sun.shadowBias;
      }
      if (updates.sun.shadowNormalBias !== undefined) {
        this._instance.shadowNormalBias = updates.sun.shadowNormalBias;
      }
      if (updates.sun.debugCSMHelper !== undefined) {
        this._instance.debugCSMHelper = updates.sun.debugCSMHelper;
      }
    }
  }

  onCreate() {
    super.onCreate();

    // Add initial lights to scene
    this.updateSceneLights();
  }

  update(_time: number): void {
    if (!this._instance) return;

    // Update sun direction from atmosphere
    this._instance.updateSunDirection(this.view.atmosphere.sunDirection);

    // Update position to camera position for proper lighting.
    const cameraPosition = this.view.camera.position;
    this._instance.updateTargetPosition(cameraPosition);

    this._instance.update();
  }

  onDestroy(): void {
    // Remove CSM lights and helper from scene before parent cleanup
    this.removeLightsFromScene();
    super.onDestroy();
  }

  /**
   * Update scene lights based on current CSM state
   */
  private updateSceneLights(): void {
    if (!this._instance) return;

    // Remove existing lights first
    this.removeLightsFromScene();

    // Add appropriate lights to scene
    const sceneLights = this._instance.getSceneLights();
    this.view.scenes.light.add(sceneLights);

    // Add CSM helper if available and enabled
    const helper = this._instance.getSceneHelper();
    if (helper) {
      this.view.scenes.opaque.add(helper);
    }
  }

  /**
   * Remove all lights and helpers from scene
   */
  private removeLightsFromScene(): void {
    if (!this._instance) return;

    // Remove CSM lights
    const sceneLights = this._instance.getCSM().directionalLights;
    sceneLights.removeFromParent();

    // Remove CSM helper
    const helper = this._instance.getSceneHelper();
    if (helper) {
      helper.removeFromParent();
    }

    // Remove sun light
    if (this.raw) {
      this.raw.removeFromParent();
    }
  }

  // CSM Coordination Methods

  /**
   * Setup a material for CSM shadows
   */
  _setupMaterialForShadows(material: Material): void {
    this._instance?.setupMaterialForCSM(material);
  }

  /**
   * Remove a material from CSM shadows
   */
  _removeMaterialFromShadows(material: Material): void {
    this._instance?.removeMaterialFromCSM(material);
  }

  /**
   * Get CSM instance for advanced usage
   */
  _getCSM() {
    return this._instance?.getCSM();
  }

  /**
   * Get CSM helper for debug visualization
   */
  _getCSMHelper() {
    return this._instance?.getCSMHelper();
  }
}
