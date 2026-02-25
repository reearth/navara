import { Plugin } from "@navara/core";
import type ThreeView from "@navara/three";
import {
  type LayerHandle,
  type SkyLightProbeLayer,
  type SunLightLayer,
} from "@navara/three";
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
} from "@navara/three_default_layers";

export class DefaultPlugin extends Plugin {
  private view?: ThreeView<DefaultLayerDescriptions>;

  async init(view: ThreeView<DefaultLayerDescriptions>) {
    this.view = view;
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
  }

  /**
   * Add default layers automatically to make the photorealistic scene.
   * This method must be invoked after `view.init()`.
   */
  // TODO: Add effect layers.
  addDefaultPhotorealLayers(): {
    sky: LayerHandle<SkyMeshLayer>;
    skyEnv: LayerHandle<SkyMeshLayer>;
    stars: LayerHandle<StarsLayer>;
    skyLightProbe: LayerHandle<SkyLightProbeLayer>;
    sun: LayerHandle<SunLightLayer>;
  } {
    if (!this.view) {
      throw new Error(
        "DefaultPlugin is not initialized. Call view.addPlugin() and view.init() first.",
      );
    }

    const view = this.view;

    return {
      sky: view.addLayer<SkyMeshLayer>({
        type: "mesh",
        sky: {},
      }),
      skyEnv: view.addLayer<SkyMeshLayer>({
        type: "mesh",
        sky: {
          envMap: true,
          sunAngularRadius: 0.1,
        },
      }),
      stars: view.addLayer<StarsLayer>({
        type: "mesh",
        stars: {},
      }),
      skyLightProbe: view.addLayer<SkyLightProbeLayer>({
        type: "light",
        skyLightProbe: {},
      }),
      sun: view.addLayer<SunLightLayer>({
        type: "light",
        sun: {},
      }),
    };
  }
}

export type DefaultLayerDescriptions = DefaultMeshLayerDeclarationDescription;

export type DefaultMeshLayerDeclarationDescription =
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
  | SmoothLineMeshLayerConfig;
