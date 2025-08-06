import { Color, Material } from "three";
import invariant from "tiny-invariant";

import {
  LightLayerDeclaration,
  type LightLayerConfig,
  ViewContext,
} from "../../core";
import { SunLight, type SunLightOptions } from "../../lights";

type LayerDescription = {
  /**
   * Sun light configuration options. Includes all CSM (Cascaded Shadow Maps) settings.
   * Color is specified as a number (hex value) instead of THREE.Color instance.
   */
  sun?: Omit<SunLightOptions, "color"> & { color?: number };
};

export type SunLightLayerConfig = LightLayerConfig & LayerDescription;

export type SunLightLayerUpdate = Pick<LightLayerConfig, "visible"> &
  LayerDescription;

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
    const color = options.color ? new Color(options.color) : undefined;

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

    if (this.config.sun && updates.sun && this.instance) {
      Object.assign(this.config.sun, updates.sun);

      // Update intensity
      if (updates.sun.intensity !== undefined) {
        this.instance.intensity = updates.sun.intensity;
      }

      // Update color
      if (updates.sun.color !== undefined) {
        this.instance.color = new Color(updates.sun.color);
      }

      if (updates.sun.applyColor !== undefined) {
        this.instance.applyColor = updates.sun.applyColor;
      }

      // Shadow
      if (updates.sun.castShadow !== undefined) {
        this.instance.castShadow = updates.sun.castShadow;
      }
      if (updates.sun.shadowMapSize !== undefined) {
        this.instance.shadowMapSize = updates.sun.shadowMapSize;
      }
      if (updates.sun.shadowFar !== undefined) {
        this.instance.shadowFar = updates.sun.shadowFar;
      }
      if (updates.sun.shadowCascadeCount !== undefined) {
        this.instance.shadowCascadeCount = updates.sun.shadowCascadeCount;
      }
      if (updates.sun.shadowMode !== undefined) {
        this.instance.shadowMode = updates.sun.shadowMode;
      }
      if (updates.sun.shadowLambda !== undefined) {
        this.instance.shadowLambda = updates.sun.shadowLambda;
      }
      if (updates.sun.shadowMargin !== undefined) {
        this.instance.shadowMargin = updates.sun.shadowMargin;
      }
      if (updates.sun.shadowFade !== undefined) {
        this.instance.shadowFade = updates.sun.shadowFade;
      }
      if (updates.sun.shadowIntensity !== undefined) {
        this.instance.shadowIntensity = updates.sun.shadowIntensity;
      }
      if (updates.sun.shadowBias !== undefined) {
        this.instance.shadowBias = updates.sun.shadowBias;
      }
      if (updates.sun.shadowNormalBias !== undefined) {
        this.instance.shadowNormalBias = updates.sun.shadowNormalBias;
      }
      if (updates.sun.debugCSMHelper !== undefined) {
        this.instance.debugCSMHelper = updates.sun.debugCSMHelper;
      }
    }
  }

  async onCreate() {
    await super.onCreate();

    // Add initial lights to scene
    this.updateSceneLights();
  }

  update(_time: number): void {
    if (!this.instance) return;

    // Update sun direction from atmosphere
    this.instance.updateSunDirection(this.view.atmosphere.sunDirection);

    // Update position to camera position for proper lighting.
    const cameraPosition = this.view.camera.position;
    this.instance.updateTargetPosition(cameraPosition);

    this.instance.update();
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
    if (!this.instance) return;

    // Remove existing lights first
    this.removeLightsFromScene();

    // Add appropriate lights to scene
    const sceneLights = this.instance.getSceneLights();
    this.view.scenes.light.add(sceneLights);

    // Add CSM helper if available and enabled
    const helper = this.instance.getSceneHelper();
    if (helper) {
      this.view.scenes.opaque.add(helper);
    }
  }

  /**
   * Remove all lights and helpers from scene
   */
  private removeLightsFromScene(): void {
    if (!this.instance) return;

    // Remove CSM lights
    const sceneLights = this.instance.getCSM().directionalLights;
    sceneLights.removeFromParent();

    // Remove CSM helper
    const helper = this.instance.getSceneHelper();
    if (helper) {
      helper.removeFromParent();
    }

    // Remove sun light
    if (this.raw) {
      this.raw.removeFromParent();
    }
  }

  getSunLight(): SunLight | null {
    return this.instance;
  }

  // CSM Coordination Methods

  /**
   * Setup a material for CSM shadows
   */
  setupMaterialForShadows(material: Material): void {
    this.instance?.setupMaterialForCSM(material);
  }

  /**
   * Remove a material from CSM shadows
   */
  removeMaterialFromShadows(material: Material): void {
    this.instance?.removeMaterialFromCSM(material);
  }

  /**
   * Get CSM instance for advanced usage
   */
  getCSM() {
    return this.instance?.getCSM();
  }

  /**
   * Get CSM helper for debug visualization
   */
  getCSMHelper() {
    return this.instance?.getCSMHelper();
  }
}
