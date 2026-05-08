import type ThreeView from "@navara/three";
import {
  Plugin,
  type MeshHandle,
  type LightHandle,
  type EffectHandle,
  type ViewContext,
} from "@navara/three";
import {
  RainMeshDesc,
  SnowMeshDesc,
  SkyMeshDesc,
  SkyBoxMeshDesc,
  StarsDesc,
  BoxMeshDesc,
  SphereMeshDesc,
  GlowGlobeMeshDesc,
  CylinderMeshDesc,
  TubeMeshDesc,
  PlaneMeshDesc,
  GLTFModelDesc,
  AxesHelperDesc,
  ArrowHelperDesc,
  ArclineMeshDesc,
  SmoothLineMeshDesc,
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
  InstancedBoxMeshDesc,
  type InstancedBoxMeshConfig,
  SplatMeshDesc,
  type SplatMeshConfig,
  AerialPerspectiveEffectDesc,
  CloudsEffectDesc,
  ColorGradingLUTEffectDesc,
  DepthOfFieldEffectDesc,
  FogLightEffectDesc,
  FXAAEffectDesc,
  LensFlareEffectDesc,
  RainDropEffectDesc,
  SelectiveBloomEffectDesc,
  SelectiveOutlineEffectDesc,
  SMAAEffectDesc,
  SSAOEffectDesc,
  SSREffectDesc,
  ToneMappingEffectDesc,
  type AerialPerspectiveConfig,
  type CloudsConfig,
  type ColorGradingLUTConfig,
  type DepthOfFieldConfig,
  type FogLightConfig,
  type FXAAConfig,
  type LensFlareConfig,
  type RainDropConfig,
  type SelectiveBloomEffectConfig,
  type SelectiveOutlineEffectConfig,
  type SMAAConfig,
  type SSAOConfig,
  type SSRConfig,
  type ToneMappingConfig,
  SunLightDesc,
  AmbientLightDesc,
  SkyLightProbeDesc,
  LightProbeDesc,
  type SunLightConfig,
  type AmbientLightConfig,
  type SkyLightProbeConfig,
  type LightProbeConfig,
} from "@navara/three_default_descs";

export class DefaultPlugin extends Plugin<
  ThreeView<DefaultDescriptions>,
  ViewContext
> {
  private view?: ThreeView<DefaultDescriptions>;

  async init(view: ThreeView<DefaultDescriptions>, _ctx: ViewContext) {
    this.view = view;

    // Register meshes
    view.registerMesh("rain", RainMeshDesc);
    view.registerMesh("snow", SnowMeshDesc);
    view.registerMesh("sky", SkyMeshDesc);
    view.registerMesh("skyBox", SkyBoxMeshDesc);
    view.registerMesh("stars", StarsDesc);
    view.registerMesh("box", BoxMeshDesc);
    view.registerMesh("sphere", SphereMeshDesc);
    view.registerMesh("glowGlobe", GlowGlobeMeshDesc);
    view.registerMesh("cylinder", CylinderMeshDesc);
    view.registerMesh("tube", TubeMeshDesc);
    view.registerMesh("plane", PlaneMeshDesc);
    view.registerMesh("gltfModel", GLTFModelDesc);
    view.registerMesh("axesHelper", AxesHelperDesc);
    view.registerMesh("arrowHelper", ArrowHelperDesc);
    view.registerMesh("arcLines", ArclineMeshDesc);
    view.registerMesh("smoothLines", SmoothLineMeshDesc);
    view.registerMesh("boxes", InstancedBoxMeshDesc);
    view.registerMesh("splat", SplatMeshDesc);

    // Register lights
    view.registerLight("sun", SunLightDesc);
    view.registerLight("ambient", AmbientLightDesc);
    view.registerLight("skyLightProbe", SkyLightProbeDesc);
    view.registerLight("lightProbe", LightProbeDesc);

    // Register effects
    view.registerEffect("aerialPerspective", AerialPerspectiveEffectDesc);
    view.registerEffect("rainDrop", RainDropEffectDesc);
    view.registerEffect("selectiveBloom", SelectiveBloomEffectDesc);
    view.registerEffect("selectiveOutline", SelectiveOutlineEffectDesc);
    view.registerEffect("clouds", CloudsEffectDesc);
    view.registerEffect("fogLight", FogLightEffectDesc);
    view.registerEffect("lensFlare", LensFlareEffectDesc);
    view.registerEffect("ssao", SSAOEffectDesc);
    view.registerEffect("ssr", SSREffectDesc);
    view.registerEffect("depthOfField", DepthOfFieldEffectDesc);
    view.registerEffect("colorGradingLUT", ColorGradingLUTEffectDesc);
    view.registerEffect("toneMapping", ToneMappingEffectDesc);
    view.registerEffect("smaa", SMAAEffectDesc);
    view.registerEffect("fxaa", FXAAEffectDesc);
  }

  /**
   * Add default descriptors automatically to make the photorealistic scene.
   * This method must be invoked after `view.init()`.
   */
  addDefaultPhotorealScene(): {
    sky: MeshHandle<SkyMeshDesc>;
    skyEnv: MeshHandle<SkyMeshDesc>;
    stars: MeshHandle<StarsDesc>;
    skyLightProbe: LightHandle<SkyLightProbeDesc>;
    sun: LightHandle<SunLightDesc>;
    aerialPerspective: EffectHandle<AerialPerspectiveEffectDesc>;
    lensFlare: EffectHandle<LensFlareEffectDesc> | undefined;
    toneMapping: EffectHandle<ToneMappingEffectDesc>;
    antialiasing: EffectHandle<SMAAEffectDesc> | EffectHandle<FXAAEffectDesc>;
  } {
    if (!this.view) {
      throw new Error(
        "DefaultPlugin is not initialized. Call view.addPlugin() and view.init() first.",
      );
    }

    const view = this.view;
    const mobile = view.isMobileOptimized();

    // Meshes
    const sky = view.addMesh<SkyMeshDesc>({
      sky: {},
    });
    const skyEnv = view.addMesh<SkyMeshDesc>({
      sky: {
        envMap: true,
        sunAngularRadius: 0.1,
      },
    });
    const stars = view.addMesh<StarsDesc>({
      stars: {},
    });

    // Lights
    const skyLightProbe = view.addLight<SkyLightProbeDesc>({
      skyLightProbe: {},
    });
    const sun = view.addLight<SunLightDesc>({
      sun: {},
    });

    // Effects
    const aerialPerspective = view.addEffect<AerialPerspectiveEffectDesc>({
      aerialPerspective: {},
    });

    // Skip lens flare on mobile - expensive effect with limited benefit
    const lensFlare = mobile
      ? undefined
      : view.addEffect<LensFlareEffectDesc>({
          lensFlare: {},
        });

    const toneMapping = view.addEffect<ToneMappingEffectDesc>({
      toneMapping: {},
    });

    // Use FXAA on mobile (faster), SMAA on desktop (higher quality)
    const antialiasing = mobile
      ? view.addEffect<FXAAEffectDesc>({
          fxaa: {},
        })
      : view.addEffect<SMAAEffectDesc>({
          smaa: {},
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

export type DefaultDescriptions = {
  mesh: DefaultMeshDescription;
  light: DefaultLightDescription;
  effect: DefaultEffectDescription;
};

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
  | SelectiveBloomEffectConfig
  | SelectiveOutlineEffectConfig
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
  | InstancedBoxMeshConfig
  | SplatMeshConfig;
