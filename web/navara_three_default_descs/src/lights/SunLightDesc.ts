import type ThreeView from "@navara/three";
import {
  Color,
  StableDirectionalLightNode,
  LightDesc,
  type LightConfig,
  type ViewContext,
  type LightUpdate,
} from "@navara/three";
import { SunDirectionalLight } from "@takram/three-atmosphere";
import { DirectionalLight, type Material } from "three/webgpu";

import { SunLight, type SunLightOptions } from "./sunLight";

type Description = {
  /**
   * Sun light configuration options. Includes all CSM (Cascaded Shadow Maps) settings.
   * Color can be specified as a number (hex value) or Navara Color instance.
   */
  sun?: Omit<SunLightOptions, "color"> & { color?: Color };
};

export type SunLightConfig = LightConfig & Description;

export type SunLightUpdate = LightUpdate & Description;

export class SunLightDesc extends LightDesc<
  SunLightConfig,
  SunLightUpdate,
  SunLight
> {
  private config: SunLightConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: SunLightConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createLight() {
    const options = this.config.sun ?? {};
    const color = options.color ? options.color.raw : undefined;

    const sunLight = new SunLight(this.view.camera.raw, {
      ...options,
      ...(color ? { color } : {}),
    } as SunLightOptions);

    // Set up atmosphere integration
    this.view.atmosphere.onTexturesReady((t) =>
      sunLight.setTransmittanceTexture(t.transmittanceTexture),
    );

    sunLight.on("needsUpdate", () => this.emit("needsUpdate"));
    sunLight.on("_csmChanged", this.updateSceneLights.bind(this));

    return sunLight;
  }

  onUpdateConfig(updates: SunLightUpdate): void {
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

    // Eagerly init the TSL CSM so its `_shadowNodes` are populated before
    // TSL graph compilation. Cascade lights are already added to
    // `scenes.light` via `updateSceneLights` above.
    this._instance?.attachToScene(this.ctx.getRenderer());

    const library = this.ctx.getNodeLibrary();
    library.addLight(StableDirectionalLightNode, SunDirectionalLight);

    const cascadeLights =
      this._instance?.getCSM().directionalLights.cascadedLights;
    if (cascadeLights && cascadeLights.length > 0) {
      const cascadeLightCtor = cascadeLights[0]
        .constructor as typeof DirectionalLight;
      library.lightNodes.delete(cascadeLightCtor);
      library.addLight(StableDirectionalLightNode, cascadeLightCtor);
    }

    // Listen for shadow material events. `setupMaterialForCSM` /
    // `removeMaterialFromCSM` internally route NodeMaterial to the TSL
    // path (no-op here; the shadow node is already attached to the sun
    // light's shadow) and legacy Material to the GLSL injection path.
    this.ctx.on("shadowApplied", (m: Material) => {
      this._instance?.setupMaterialForCSM(m);
    });
    this.ctx.on("shadowRemoved", (m: Material) => {
      this._instance?.removeMaterialFromCSM(m);
    });
  }

  update(_time: number): void {
    if (!this._instance) return;

    // Update sun direction from atmosphere
    this._instance.updateSunDirection(this.view.atmosphere.sunDirection);

    // Update position to camera position for proper lighting.
    const cameraPosition = this.view.camera.raw.position;
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
    this.ctx.scenes.light.add(sceneLights);

    // Add CSM helper if available and enabled
    const helper = this._instance.getSceneHelper();
    if (helper) {
      this.ctx.scenes.opaque.add(helper);
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
}
