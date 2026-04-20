import type ThreeView from "@navara/three";
import { Plugin, type LayerHandle, type ViewContext } from "@navara/three";
import {
  RainMeshLayer,
  SnowMeshLayer,
  SkyMeshLayer,
  SkyBoxMeshLayer,
  StarsLayer,
  BoxMeshLayer,
  SphereMeshLayer,
  GlowGlobeMeshLayer,
  CylinderMeshLayer,
  TubeMeshLayer,
  PlaneMeshLayer,
  GLTFModelLayer,
  AxesHelperLayer,
  ArrowHelperLayer,
  ArclineMeshLayer,
  SmoothLineMeshLayer,
  type RainMeshLayerConfig,
  type SnowMeshLayerConfig,
  type SkyMeshLayerConfig,
  type SkyBoxMeshLayerConfig,
  type StarsLayerConfig,
  type BoxMeshLayerConfig,
  type SphereMeshLayerConfig,
  type GlowGlobeMeshLayerConfig,
  type CylinderMeshLayerConfig,
  type TubeMeshLayerConfig,
  type PlaneMeshLayerConfig,
  type GLTFModelLayerConfig,
  type AxesHelperLayerConfig,
  type ArrowHelperLayerConfig,
  type ArclineMeshLayerConfig,
  type SmoothLineMeshLayerConfig,
  InstancedBoxMeshLayer,
  type InstancedBoxMeshLayerConfig,
  AerialPerspectiveEffectLayer,
  CloudsEffectLayer,
  ColorGradingLUTEffectLayer,
  DepthOfFieldEffectLayer,
  FogLightEffectLayer,
  FXAAEffectLayer,
  LensFlareEffectLayer,
  RainDropEffectLayer,
  SMAAEffectLayer,
  SSAOEffectLayer,
  SSREffectLayer,
  ToneMappingEffectLayer,
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
  SunLightLayer,
  AmbientLightLayer,
  SkyLightProbeLayer,
  LightProbeLayer,
  type SunLightLayerConfig,
  type AmbientLightLayerConfig,
  type SkyLightProbeLayerConfig,
  type LightProbeLayerConfig,
} from "@navara/three_default_layers";

export class DefaultPlugin extends Plugin<
  ThreeView<DefaultDeclarations>,
  ViewContext
> {
  private view?: ThreeView<DefaultDeclarations>;

  async init(view: ThreeView<DefaultDeclarations>, _ctx: ViewContext) {
    this.view = view;

    // Register mesh layers
    view.registerMesh("rain", RainMeshLayer);
    view.registerMesh("snow", SnowMeshLayer);
    view.registerMesh("sky", SkyMeshLayer);
    view.registerMesh("skyBox", SkyBoxMeshLayer);
    view.registerMesh("stars", StarsLayer);
    view.registerMesh("box", BoxMeshLayer);
    view.registerMesh("sphere", SphereMeshLayer);
    view.registerMesh("glowGlobe", GlowGlobeMeshLayer);
    view.registerMesh("cylinder", CylinderMeshLayer);
    view.registerMesh("tube", TubeMeshLayer);
    view.registerMesh("plane", PlaneMeshLayer);
    view.registerMesh("gltfModel", GLTFModelLayer);
    view.registerMesh("axesHelper", AxesHelperLayer);
    view.registerMesh("arrowHelper", ArrowHelperLayer);
    view.registerMesh("arcLines", ArclineMeshLayer);
    view.registerMesh("smoothLines", SmoothLineMeshLayer);
    view.registerMesh("boxes", InstancedBoxMeshLayer);

    // Register light layers
    view.registerLight("sun", SunLightLayer);
    view.registerLight("ambient", AmbientLightLayer);
    view.registerLight("skyLightProbe", SkyLightProbeLayer);
    view.registerLight("lightProbe", LightProbeLayer);

    // Register effect layers
    view.registerEffect("aerialPerspective", AerialPerspectiveEffectLayer);
    view.registerEffect("rainDrop", RainDropEffectLayer);
    view.registerEffect("clouds", CloudsEffectLayer);
    view.registerEffect("fogLight", FogLightEffectLayer);
    view.registerEffect("lensFlare", LensFlareEffectLayer);
    view.registerEffect("ssao", SSAOEffectLayer);
    view.registerEffect("ssr", SSREffectLayer);
    view.registerEffect("depthOfField", DepthOfFieldEffectLayer);
    view.registerEffect("colorGradingLUT", ColorGradingLUTEffectLayer);
    view.registerEffect("toneMapping", ToneMappingEffectLayer);
    view.registerEffect("smaa", SMAAEffectLayer);
    view.registerEffect("fxaa", FXAAEffectLayer);
  }

  /**
   * Add default layers automatically to make the photorealistic scene.
   * This method must be invoked after `view.init()`.
   */
  addDefaultPhotorealLayers(): {
    sky: LayerHandle<SkyMeshLayer>;
    skyEnv: LayerHandle<SkyMeshLayer>;
    stars: LayerHandle<StarsLayer>;
    skyLightProbe: LayerHandle<SkyLightProbeLayer>;
    sun: LayerHandle<SunLightLayer>;
    aerialPerspective: LayerHandle<AerialPerspectiveEffectLayer>;
    lensFlare: LayerHandle<LensFlareEffectLayer> | undefined;
    toneMapping: LayerHandle<ToneMappingEffectLayer>;
    antialiasing: LayerHandle<SMAAEffectLayer> | LayerHandle<FXAAEffectLayer>;
  } {
    if (!this.view) {
      throw new Error(
        "DefaultPlugin is not initialized. Call view.addPlugin() and view.init() first.",
      );
    }

    const view = this.view;
    const mobile = view.isMobileOptimized();

    // Mesh layers
    const sky = view.addMesh<SkyMeshLayer>({
      sky: {},
    });
    const skyEnv = view.addMesh<SkyMeshLayer>({
      sky: {
        envMap: true,
        sunAngularRadius: 0.1,
      },
    });
    const stars = view.addMesh<StarsLayer>({
      stars: {},
    });

    // Light layers
    const skyLightProbe = view.addLight<SkyLightProbeLayer>({
      skyLightProbe: {},
    });
    const sun = view.addLight<SunLightLayer>({
      sun: {},
    });

    // Effect layers
    const aerialPerspective = view.addEffect<AerialPerspectiveEffectLayer>({
      aerialPerspective: {},
    });

    // Skip lens flare on mobile - expensive effect with limited benefit
    const lensFlare = mobile
      ? undefined
      : view.addEffect<LensFlareEffectLayer>({
          lensFlare: {},
        });

    const toneMapping = view.addEffect<ToneMappingEffectLayer>({
      toneMapping: {},
    });

    // Use FXAA on mobile (faster), SMAA on desktop (higher quality)
    const antialiasing = mobile
      ? view.addEffect<FXAAEffectLayer>({
          fxaa: {},
        })
      : view.addEffect<SMAAEffectLayer>({
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

export type DefaultDeclarations = {
  mesh: DefaultMeshDescription;
  light: DefaultLightDescription;
  effect: DefaultEffectDescription;
};

export type DefaultLightDescription =
  | SunLightLayerConfig
  | SkyLightProbeLayerConfig
  | AmbientLightLayerConfig
  | LightProbeLayerConfig;

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
  | RainMeshLayerConfig
  | SnowMeshLayerConfig
  | SkyMeshLayerConfig
  | SkyBoxMeshLayerConfig
  | StarsLayerConfig
  | BoxMeshLayerConfig
  | SphereMeshLayerConfig
  | GlowGlobeMeshLayerConfig
  | CylinderMeshLayerConfig
  | TubeMeshLayerConfig
  | PlaneMeshLayerConfig
  | GLTFModelLayerConfig
  | AxesHelperLayerConfig
  | ArrowHelperLayerConfig
  | ArclineMeshLayerConfig
  | SmoothLineMeshLayerConfig
  | InstancedBoxMeshLayerConfig;
