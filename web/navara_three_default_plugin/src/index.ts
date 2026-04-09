import type ThreeView from "@navara/three";
import { Plugin, type Handle } from "@navara/three";
import {
  RainMeshDeclaration,
  SnowMeshDeclaration,
  SkyMeshDeclaration,
  SkyBoxMeshDeclaration,
  StarsDeclaration,
  BoxMeshDeclaration,
  SphereMeshDeclaration,
  GlowGlobeMeshDeclaration,
  CylinderMeshDeclaration,
  TubeMeshDeclaration,
  PlaneMeshDeclaration,
  GLTFModelDeclaration,
  AxesHelperDeclaration,
  ArrowHelperDeclaration,
  ArclineMeshDeclaration,
  SmoothLineMeshDeclaration,
  type RainMeshConfig,
  type SnowMeshConfig,
  type SkyMeshConfig,
  type SkyBoxMeshConfig,
  type StarsConfig,
  type BoxMeshConfig,
  type SphereMeshConfig,
  type GlowGlobeMeshConfig,
  type CylinderMeshConfig,
  type TubeMeshConfig,
  type PlaneMeshConfig,
  type GLTFModelConfig,
  type AxesHelperConfig,
  type ArrowHelperConfig,
  type ArclineMeshConfig,
  type SmoothLineMeshConfig,
  InstancedBoxMeshDeclaration,
  type InstancedBoxMeshConfig,
  AerialPerspectiveEffectDeclaration,
  CloudsEffectDeclaration,
  ColorGradingLUTEffectDeclaration,
  DepthOfFieldEffectDeclaration,
  FogLightEffectDeclaration,
  FXAAEffectDeclaration,
  LensFlareEffectDeclaration,
  RainDropEffectDeclaration,
  SMAAEffectDeclaration,
  SSAOEffectDeclaration,
  SSREffectDeclaration,
  ToneMappingEffectDeclaration,
  type AerialPerspectiveConfig,
  type CloudsConfig,
  type ColorGradingLUTConfig,
  type DepthOfFieldConfig,
  type FogLightConfig,
  type FXAAConfig,
  type LensFlareConfig,
  type RainDropConfig,
  type SMAAConfig,
  type SSAOConfig,
  type SSRConfig,
  type ToneMappingConfig,
  SunLightDeclaration,
  AmbientLightDeclaration,
  SkyLightProbeDeclaration,
  LightProbeDeclaration,
  type SunLightConfig,
  type AmbientLightConfig,
  type SkyLightProbeConfig,
  type LightProbeConfig,
} from "@navara/three_default_layers";

export class DefaultPlugin extends Plugin<ThreeView<DefaultDescriptions>> {
  private view?: ThreeView<DefaultDescriptions>;

  async init(view: ThreeView<DefaultDescriptions>) {
    this.view = view;

    // Register mesh layers
    view.registerMesh("rain", RainMeshDeclaration);
    view.registerMesh("snow", SnowMeshDeclaration);
    view.registerMesh("sky", SkyMeshDeclaration);
    view.registerMesh("skyBox", SkyBoxMeshDeclaration);
    view.registerMesh("stars", StarsDeclaration);
    view.registerMesh("box", BoxMeshDeclaration);
    view.registerMesh("sphere", SphereMeshDeclaration);
    view.registerMesh("glowGlobe", GlowGlobeMeshDeclaration);
    view.registerMesh("cylinder", CylinderMeshDeclaration);
    view.registerMesh("tube", TubeMeshDeclaration);
    view.registerMesh("plane", PlaneMeshDeclaration);
    view.registerMesh("gltfModel", GLTFModelDeclaration);
    view.registerMesh("axesHelper", AxesHelperDeclaration);
    view.registerMesh("arrowHelper", ArrowHelperDeclaration);
    view.registerMesh("arcLines", ArclineMeshDeclaration);
    view.registerMesh("smoothLines", SmoothLineMeshDeclaration);
    view.registerMesh("boxes", InstancedBoxMeshDeclaration);

    // Register light layers
    view.registerLight("sun", SunLightDeclaration);
    view.registerLight("ambient", AmbientLightDeclaration);
    view.registerLight("skyLightProbe", SkyLightProbeDeclaration);
    view.registerLight("lightProbe", LightProbeDeclaration);

    // Register effect layers
    view.registerEffect("aerialPerspective", AerialPerspectiveEffectDeclaration);
    view.registerEffect("rainDrop", RainDropEffectDeclaration);
    view.registerEffect("clouds", CloudsEffectDeclaration);
    view.registerEffect("fogLight", FogLightEffectDeclaration);
    view.registerEffect("lensFlare", LensFlareEffectDeclaration);
    view.registerEffect("ssao", SSAOEffectDeclaration);
    view.registerEffect("ssr", SSREffectDeclaration);
    view.registerEffect("depthOfField", DepthOfFieldEffectDeclaration);
    view.registerEffect("colorGradingLUT", ColorGradingLUTEffectDeclaration);
    view.registerEffect("toneMapping", ToneMappingEffectDeclaration);
    view.registerEffect("smaa", SMAAEffectDeclaration);
    view.registerEffect("fxaa", FXAAEffectDeclaration);
  }

  /**
   * Add default layers automatically to make the photorealistic scene.
   * This method must be invoked after `view.init()`.
   */
  addDefaultPhotorealLayers(): {
    sky: Handle<SkyMeshDeclaration>;
    skyEnv: Handle<SkyMeshDeclaration>;
    stars: Handle<StarsDeclaration>;
    skyLightProbe: Handle<SkyLightProbeDeclaration>;
    sun: Handle<SunLightDeclaration>;
    aerialPerspective: Handle<AerialPerspectiveEffectDeclaration>;
    lensFlare: Handle<LensFlareEffectDeclaration> | undefined;
    toneMapping: Handle<ToneMappingEffectDeclaration>;
    antialiasing: Handle<SMAAEffectDeclaration> | Handle<FXAAEffectDeclaration>;
  } {
    if (!this.view) {
      throw new Error(
        "DefaultPlugin is not initialized. Call view.addPlugin() and view.init() first.",
      );
    }

    const view = this.view;
    const mobile = view.isMobileOptimized();

    // Mesh & light layers
    const sky = view.addMesh<SkyMeshDeclaration>({
      type: "sky",
    });
    const skyEnv = view.addMesh<SkyMeshDeclaration>({
      type: "sky",
      envMap: true,
      sunAngularRadius: 0.1,
    });
    const stars = view.addMesh<StarsDeclaration>({
      type: "stars",
    });
    const skyLightProbe = view.addLight<SkyLightProbeDeclaration>({
      type: "skyLightProbe",
    });
    const sun = view.addLight<SunLightDeclaration>({
      type: "sun",
    });

    // Effect layers
    const aerialPerspective = view.addEffect<AerialPerspectiveEffectDeclaration>({
      type: "aerialPerspective",
    });

    // Skip lens flare on mobile - expensive effect with limited benefit
    const lensFlare = mobile
      ? undefined
      : view.addEffect<LensFlareEffectDeclaration>({
          type: "lensFlare",
        });

    const toneMapping = view.addEffect<ToneMappingEffectDeclaration>({
      type: "toneMapping",
    });

    // Use FXAA on mobile (faster), SMAA on desktop (higher quality)
    const antialiasing = mobile
      ? view.addEffect<FXAAEffectDeclaration>({
          type: "fxaa",
        })
      : view.addEffect<SMAAEffectDeclaration>({
          type: "smaa",
        });

    return {
      sky,
      skyEnv,
      stars,
      skyLightProbe,
      sun,
      aerialPerspective,
      lensFlare,
      toneMapping,
      antialiasing,
    };
  }
}

export type DefaultDescriptions =
  | DefaultMeshDescription
  | DefaultLightDescription
  | DefaultEffectDescription;

export type DefaultLightDescription =
  | SunLightConfig
  | SkyLightProbeConfig
  | AmbientLightConfig
  | LightProbeConfig;

export type DefaultEffectDescription =
  | AerialPerspectiveConfig
  | CloudsConfig
  | ColorGradingLUTConfig
  | DepthOfFieldConfig
  | FogLightConfig
  | FXAAConfig
  | LensFlareConfig
  | RainDropConfig
  | SMAAConfig
  | SSAOConfig
  | SSRConfig
  | ToneMappingConfig;

export type DefaultMeshDescription =
  | RainMeshConfig
  | SnowMeshConfig
  | SkyMeshConfig
  | SkyBoxMeshConfig
  | StarsConfig
  | BoxMeshConfig
  | SphereMeshConfig
  | GlowGlobeMeshConfig
  | CylinderMeshConfig
  | TubeMeshConfig
  | PlaneMeshConfig
  | GLTFModelConfig
  | AxesHelperConfig
  | ArrowHelperConfig
  | ArclineMeshConfig
  | SmoothLineMeshConfig
  | InstancedBoxMeshConfig;
