import { EventHandler } from "@navara/core";
import ThreeView, {
  DEFAULT_CLOUDS_OPTIONS,
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
  type CloudsOptions,
  type LayerDescription,
  type SSAOQualityMode,
  SkyMeshLayer,
  StarsLayer,
  LayerHandle,
  SunLightLayer,
  AmbientLightLayer,
  SkyLightProbeLayer,
} from "@navara/three";
import type { TextureChannel } from "@takram/three-clouds";
import { Color, SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import type {
  AerialPerspectiveEffectLayer,
  CloudsEffectLayer,
  SSAOEffectLayer,
} from "../../../src/layers/effect";
import type { LightProbeLayer } from "../../../src/layers/light/LightProbeLayer";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import {
  addCameraControl,
  addDateControl,
  addHidePaneKeyShortcut,
} from "../../helpers/control";
import {
  addFieldsToFolder,
  type FieldsApis,
  type FolderFields,
} from "../../helpers/panel";
import { SH_COEFFICIENTS } from "../../helpers/sh";

type DefaultEffects = ReturnType<ThreeView["addDefaultEffectLayers"]>;

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultEffects = view.addDefaultEffectLayers();
  const defaultLayers = view.addDefaultAtmosphereLayers();

  // Add clouds effect layer explicitly
  const cloudsLayer = view.addLayer<CloudsEffectLayer>({
    type: "effect",
    clouds: {},
  });

  // Cast to specific layer types for easier access and updates
  const skyLayer = defaultLayers.sky;
  const starsLayer = defaultLayers.stars;
  const sunLightLayer = defaultLayers.sun;
  const skyLightProbeLayer = defaultLayers.skyLightProbe;

  sunLightLayer.update({
    sun: {
      castShadow: true,
    },
  });

  // Add an additional ambient light layer
  const ambientLightLayer: LayerHandle<AmbientLightLayer> = view.addLayer({
    type: "light",
    visible: false,
    ambient: {
      intensity: 1,
      color: 0xffffff,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 6,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
      cast_shadow: true,
      receive_shadow: true,
      height: -50,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
      cast_shadow: true,
      receive_shadow: true,
      height: -50,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  addHidePaneKeyShortcut(pane);

  addCameraControl(view, pane);
  const tileBinding = addTileControl(view, pane);
  addCloudsTilesControl(view, pane, tileBinding);
  addDateControl(view, pane);
  addAtmosphereControl(
    pane,
    skyLayer,
    starsLayer,
    sunLightLayer,
    ambientLightLayer,
    skyLightProbeLayer,
    defaultEffects.aerialPerspective,
  );
  addCloudsControl(view, pane, cloudsLayer);
  addAAControl(pane, defaultEffects);
  addIBLControl(view, pane);
  addEffectsControl(view, pane, defaultEffects);
};

const addTileControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    type: TILE_URLS.gsiSeamlessphoto,
  };

  const description: LayerDescription = {
    type: "tiles",
    data: {
      url: PARAMS.type,
    },
    raster_tile: {
      max_zoom: 18,
      min_zoom: 2,
    },
  };

  let layer = view.addLayer(description);

  const folder = pane.addFolder({
    title: "RasterTile",
  });

  const tileChangeBinding = new EventHandler();

  folder
    .addBinding(PARAMS, "type", {
      options: TILE_URLS,
    })
    .on("change", (v) => {
      layer.delete();
      layer = view.addLayer({
        ...description,
        data: {
          url: v.value,
        },
      });
      tileChangeBinding.emit("change");
    });

  return tileChangeBinding;
};

const addCloudsTilesControl = (
  view: ThreeView,
  pane: Pane,
  tileChangeBinding: EventHandler,
) => {
  const PARAMS = {
    show: true,
  };

  const description: LayerDescription = {
    type: "tiles",
    data: {
      url: "/data/blue-marble-clouds/{z}/{x}/{y}.webp",
    },
    raster_tile: {
      max_zoom: 6,
      min_zoom: 2,
    },
  };

  let cloudsTilesLayer = view.addLayer(description);

  const folder = pane.addFolder({
    title: "CloudsTiles",
  });

  const transitionTile = () => {
    const position = view.camera.getPosition();
    if (!position?.height) return;
    const targetHeight = 35e6;
    const opacity = Math.min(1, position.height / targetHeight);

    if (!description.raster_tile) return;
    description.raster_tile.opacity = opacity;
    cloudsTilesLayer.update(description);
  };

  view.camera.on("move", transitionTile);
  view.camera.on("moveend", transitionTile);

  const fields: FolderFields<typeof PARAMS> = [
    {
      name: "show",
      onChange: (v) => {
        if (!description.raster_tile) return;
        description.raster_tile.show = v.value;
        cloudsTilesLayer.update(description);
      },
    },
  ];

  addFieldsToFolder(folder, PARAMS, fields);

  tileChangeBinding.on("change", () => {
    cloudsTilesLayer.delete();
    cloudsTilesLayer = view.addLayer(description);
  });
};

const addAtmosphereControl = (
  pane: Pane,
  skyLayer: LayerHandle<SkyMeshLayer>,
  starsLayer: LayerHandle<StarsLayer>,
  sunLightLayer: LayerHandle<SunLightLayer>,
  ambientLightLayer: LayerHandle<AmbientLightLayer>,
  _skyLightProbeLayer: LayerHandle<SkyLightProbeLayer>,
  aerialPerspectiveLayer: LayerHandle<AerialPerspectiveEffectLayer>,
) => {
  const PARAMS = {
    aerialPerspective: true,
    sky: true,
    sun: true,
    moon: true,
    stars: true,
    sunLight: true,
    sunLightColor: 0xffffff,
    sunApplyLightColor: false,
    sunLightIntensity: 1,
    moonScale: 1,
    moonIntensity: 1,
    starsPointSize: 1,
    starsRadianceScale: 10,
    ambientLight: false,
    ambientLightColor: 0xffffff,
    ambientLightIntensity: 1,
    inscatter: true,
    transmittance: true,
    irradiance: false,
  };

  const folder = pane.addFolder({
    title: "Atmosphere",
  });

  folder.addBinding(PARAMS, "aerialPerspective").on("change", (v) => {
    aerialPerspectiveLayer.update({
      visible: v.value,
    });
  });
  folder.addBinding(PARAMS, "sky").on("change", (v) => {
    skyLayer.visible = v.value;
  });
  folder.addBinding(PARAMS, "sun").on("change", (v) => {
    skyLayer.update({ sky: { sun: v.value } });
  });
  folder.addBinding(PARAMS, "moon").on("change", (v) => {
    skyLayer.update({ sky: { moon: v.value } });
  });
  folder.addBinding(PARAMS, "stars").on("change", (v) => {
    starsLayer.visible = v.value;
  });
  folder.addBinding(PARAMS, "sunLight").on("change", (v) => {
    sunLightLayer.visible = v.value;
  });
  folder
    .addBinding(PARAMS, "sunLightColor", { color: { type: "int" } })
    .on("change", (v) => {
      sunLightLayer.update({ sun: { color: v.value } });
    });
  folder.addBinding(PARAMS, "sunApplyLightColor").on("change", (v) => {
    sunLightLayer.update({ sun: { applyColor: v.value } });
  });
  folder.addBinding(PARAMS, "moonScale").on("change", (v) => {
    skyLayer.update({ sky: { moonScale: v.value } });
  });
  folder.addBinding(PARAMS, "moonIntensity").on("change", (v) => {
    skyLayer.update({ sky: { moonIntensity: v.value } });
  });
  folder.addBinding(PARAMS, "starsPointSize").on("change", (v) => {
    starsLayer.update({ stars: { pointSize: v.value } });
  });
  folder.addBinding(PARAMS, "starsRadianceScale").on("change", (v) => {
    starsLayer.update({ stars: { intensity: v.value } });
  });
  folder.addBinding(PARAMS, "sunLightIntensity").on("change", (v) => {
    sunLightLayer.update({ sun: { intensity: v.value } });
  });
  folder.addBinding(PARAMS, "ambientLight").on("change", (v) => {
    ambientLightLayer.visible = v.value;
  });
  folder
    .addBinding(PARAMS, "ambientLightColor", { color: { type: "int" } })
    .on("change", (v) => {
      ambientLightLayer.update({
        ambient: { color: v.value },
      });
    });
  folder.addBinding(PARAMS, "ambientLightIntensity").on("change", (v) => {
    ambientLightLayer.update({ ambient: { intensity: v.value } });
  });
  folder.addBinding(PARAMS, "inscatter").on("change", (v) => {
    aerialPerspectiveLayer.update({
      aerialPerspective: {
        inscatter: v.value,
      },
    });
  });
  folder.addBinding(PARAMS, "transmittance").on("change", (v) => {
    aerialPerspectiveLayer.update({
      aerialPerspective: {
        transmittance: v.value,
      },
    });
  });
  folder.addBinding(PARAMS, "irradiance").on("change", (v) => {
    aerialPerspectiveLayer.update({
      aerialPerspective: {
        irradiance: v.value,
      },
    });
  });
};

const addCloudsControl = (
  view: ThreeView,
  pane: Pane,
  cloudsLayerHandle: LayerHandle<CloudsEffectLayer>,
) => {
  const BASE_PARAMS = {
    enable: true,
    coverage: DEFAULT_CLOUDS_OPTIONS.coverage,
    qualityPreset: DEFAULT_CLOUDS_OPTIONS.qualityPreset,
    animation: false,
    lightShafts: !!DEFAULT_CLOUDS_OPTIONS.lightShafts,

    // Processing
    resolutionScale: DEFAULT_CLOUDS_OPTIONS.resolutionScale,
    maxIterationCount: 50,
    minStepSize: 100,
    maxStepSize: 1000,
  };
  const SHADOW_PARAMS = {
    shadows: DEFAULT_CLOUDS_OPTIONS.shadows,
    shadowCascadeCount: DEFAULT_CLOUDS_OPTIONS.shadowCascadeCount,
    shadowMapSize: DEFAULT_CLOUDS_OPTIONS.shadowMapSize.x,
  };
  const HAZE_PARAMS = {
    haze: DEFAULT_CLOUDS_OPTIONS.haze,
    hazeDensityScale: DEFAULT_CLOUDS_OPTIONS.hazeDensityScale,
    hazeExponent: DEFAULT_CLOUDS_OPTIONS.hazeExponent,
    hazeScatteringCoefficient: DEFAULT_CLOUDS_OPTIONS.hazeScatteringCoefficient,
    hazeAbsorptionCoefficient: DEFAULT_CLOUDS_OPTIONS.hazeAbsorptionCoefficient,
  };
  const WEATHER_AND_SHAPE_PARAMS = {
    localWeatherRepeat: DEFAULT_CLOUDS_OPTIONS.localWeatherRepeat.x,
    localWeatherOffset: DEFAULT_CLOUDS_OPTIONS.localWeatherOffset,
    shapeRepeat: DEFAULT_CLOUDS_OPTIONS.shapeRepeat.x,
    shapeOffset: DEFAULT_CLOUDS_OPTIONS.shapeOffset,
    shapeDetailRepeat: DEFAULT_CLOUDS_OPTIONS.shapeDetailRepeat.x,
    shapeDetailOffset: DEFAULT_CLOUDS_OPTIONS.shapeDetailOffset,
    turbulenceRepeat: DEFAULT_CLOUDS_OPTIONS.turbulenceRepeat.x,
    turbulenceDisplacement: DEFAULT_CLOUDS_OPTIONS.turbulenceDisplacement,
  };
  const SCATTERING_PARAMS = {
    scatteringCoefficient: DEFAULT_CLOUDS_OPTIONS.scatteringCoefficient,
    absorptionCoefficient: DEFAULT_CLOUDS_OPTIONS.absorptionCoefficient,
    scatterAnisotropy1: DEFAULT_CLOUDS_OPTIONS.scatterAnisotropy1,
    scatterAnisotropy2: DEFAULT_CLOUDS_OPTIONS.scatterAnisotropy2,
    scatterAnisotropyMix: DEFAULT_CLOUDS_OPTIONS.scatterAnisotropyMix,
    skyLightScale: DEFAULT_CLOUDS_OPTIONS.skyLightScale,
    groundBounceScale: DEFAULT_CLOUDS_OPTIONS.groundBounceScale,
    powderScale: DEFAULT_CLOUDS_OPTIONS.powderScale,
    powderExponent: DEFAULT_CLOUDS_OPTIONS.powderExponent,
  };
  const CLOUD_LAYERS_PARAMS = {
    index: 0,
    channel: "r",
    altitude: 0,
    height: 0,
    densityScale: 0,
    shapeAmount: 0,
    shapeDetailAmount: 0,
    weatherExponent: 0,
    shapeAlteringBias: 0,
    coverageFilterWidth: 0,
    shadow: false,
    expTerm: 0,
    exponent: 0,
    linearTerm: 0,
    constantTerm: 0,
  };

  const cloudsLayer = cloudsLayerHandle.ref.raw;

  const baseFields: FolderFields<typeof BASE_PARAMS> = [
    {
      name: "enable",
      onChange: (v) => {
        if (!cloudsLayer) return;
        if (v.value) {
          cloudsLayer.coverage = BASE_PARAMS.coverage;
        } else {
          cloudsLayer.coverage = 0;
        }
      },
    },
    {
      name: "coverage",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.coverage = v.value;
      },
    },
    {
      name: "qualityPreset",
      params: {
        options: Object.fromEntries(
          ["ultra", "high", "medium", "low"].map((v) => [v, v]),
        ),
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.qualityPreset =
          v.value as Required<CloudsOptions>["qualityPreset"];
      },
    },
    {
      name: "animation",
      onChange: (v) => {
        if (cloudsLayer) {
          cloudsLayer.localWeatherVelocity.x = v.value ? 0.001 : 0;
          view.forceUpdate();
        }
        view.animation = v.value;
      },
    },
    {
      name: "lightShafts",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.lightShafts = v.value;
      },
    },

    // Processing
    {
      name: "resolutionScale",
      params: {
        options: [1, 0.5, 0.25].map((v) => ({ text: v.toString(), value: v })),
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.resolutionScale = v.value;
      },
    },
    {
      name: "maxIterationCount",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.maxIterationCount = v.value;
      },
    },
    {
      name: "minStepSize",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.minStepSize = v.value;
      },
    },
    {
      name: "maxStepSize",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.maxStepSize = v.value;
      },
    },
  ];
  const shadowFields: FolderFields<typeof SHADOW_PARAMS> = [
    // Shadow
    {
      name: "shadows",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shadows = v.value;
      },
    },
    {
      name: "shadowCascadeCount",
      params: {
        options: Object.fromEntries(
          [...new Array(4)].map((_, i) => [`${i + 1}`, i + 1]),
        ),
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shadowCascadeCount = v.value;
      },
    },
    {
      name: "shadowMapSize",
      params: {
        options: {
          "128": 128,
          "256": 256,
          "512": 512,
          "1024": 1024,
        },
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shadowMapSize.set(v.value, v.value);
        view.forceUpdate();
      },
    },
  ];
  const hazeFields: FolderFields<typeof HAZE_PARAMS> = [
    // Haze
    {
      name: "haze",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.haze = v.value;
      },
    },
    {
      name: "hazeDensityScale",
      params: {
        min: 0,
        step: 3e-5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.hazeDensityScale = v.value;
      },
    },
    {
      name: "hazeExponent",
      params: {
        min: 0,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.hazeExponent = v.value;
      },
    },
    {
      name: "hazeScatteringCoefficient",
      params: {
        min: 0,
        max: 5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.hazeScatteringCoefficient = v.value;
      },
    },
    {
      name: "hazeAbsorptionCoefficient",
      params: {
        min: 0,
        max: 5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.hazeAbsorptionCoefficient = v.value;
      },
    },
  ];

  const weatherAndShapeFields: FolderFields<typeof WEATHER_AND_SHAPE_PARAMS> = [
    // Weather and shape
    {
      name: "localWeatherRepeat",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.localWeatherRepeat.setScalar(v.value);
        view.forceUpdate();
      },
    },
    {
      name: "localWeatherOffset",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.localWeatherOffset = v.value;
      },
    },
    {
      name: "shapeRepeat",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shapeRepeat.setScalar(v.value);
        view.forceUpdate();
      },
    },
    {
      name: "shapeOffset",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shapeOffset = v.value;
      },
    },
    {
      name: "shapeDetailRepeat",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shapeDetailRepeat.setScalar(v.value);
        view.forceUpdate();
      },
    },
    {
      name: "shapeDetailOffset",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.shapeDetailOffset = v.value;
      },
    },
    {
      name: "turbulenceRepeat",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.turbulenceRepeat.setScalar(v.value);
        view.forceUpdate();
      },
    },
    {
      name: "turbulenceDisplacement",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.turbulenceDisplacement = v.value;
      },
    },
  ];
  const scatteringFields: FolderFields<typeof SCATTERING_PARAMS> = [
    // Scattering
    {
      name: "scatteringCoefficient",
      params: {
        min: 0,
        max: 5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.scatteringCoefficient = v.value;
      },
    },
    {
      name: "absorptionCoefficient",
      params: {
        min: 0,
        max: 5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.absorptionCoefficient = v.value;
      },
    },
    {
      name: "scatterAnisotropy1",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.scatterAnisotropy1 = v.value;
      },
    },
    {
      name: "scatterAnisotropy2",
      params: {
        min: -1,
        max: 0,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.scatterAnisotropy2 = v.value;
      },
    },
    {
      name: "scatterAnisotropyMix",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.scatterAnisotropyMix = v.value;
      },
    },
    {
      name: "skyLightScale",
      params: {
        min: 0,
        max: 5,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.skyLightScale = v.value;
      },
    },
    {
      name: "groundBounceScale",
      params: {
        min: 0,
        max: 10,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.groundBounceScale = v.value;
      },
    },
    {
      name: "powderScale",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.powderScale = v.value;
      },
    },
    {
      name: "powderExponent",
      params: {
        min: 1,
        max: 1000,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.powderExponent = v.value;
      },
    },
  ];

  const onChangeCloudLayerIndex = (
    idx: number,
    apis: FieldsApis<typeof CLOUD_LAYERS_PARAMS>,
  ) => {
    if (!cloudsLayer) return;
    const layer = cloudsLayer.cloudLayers[idx];
    apis.channel.controller.value.rawValue = layer.channel;
    apis.altitude.controller.value.rawValue = layer.altitude;
    apis.height.controller.value.rawValue = layer.height;
    apis.densityScale.controller.value.rawValue = layer.densityScale;
    apis.shapeAmount.controller.value.rawValue = layer.shapeAmount;
    apis.shapeDetailAmount.controller.value.rawValue = layer.shapeDetailAmount;
    apis.weatherExponent.controller.value.rawValue = layer.weatherExponent;
    apis.shapeAlteringBias.controller.value.rawValue = layer.shapeAlteringBias;
    apis.coverageFilterWidth.controller.value.rawValue =
      layer.coverageFilterWidth;
    apis.shadow.controller.value.rawValue = layer.shadow;
    apis.expTerm.controller.value.rawValue = layer.expTerm;
    apis.exponent.controller.value.rawValue = layer.exponent;
    apis.linearTerm.controller.value.rawValue = layer.linearTerm;
    apis.constantTerm.controller.value.rawValue = layer.constantTerm;
  };
  const cloudLayersFields: FolderFields<typeof CLOUD_LAYERS_PARAMS> = [
    // Scattering
    {
      name: "index",
      params: {
        options: [0, 1, 2, 3].map((v) => ({ text: `${v}`, value: v })),
      },
      onMount: (apis) =>
        onChangeCloudLayerIndex(CLOUD_LAYERS_PARAMS.index, apis),
      onChange: (v, apis) => onChangeCloudLayerIndex(v.value, apis),
    },
    {
      name: "channel",
      params: {
        options: ["r", "g", "b", "a"].map((v) => ({ text: v, value: v })),
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].channel =
          v.value as TextureChannel;
      },
    },
    {
      name: "altitude",
      params: {
        step: 20,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].altitude = v.value;
      },
    },
    {
      name: "height",
      params: {
        step: 20,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].height = v.value;
      },
    },
    {
      name: "densityScale",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].densityScale =
          v.value;
      },
    },
    {
      name: "shapeAmount",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].shapeAmount =
          v.value;
      },
    },
    {
      name: "shapeDetailAmount",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].shapeDetailAmount =
          v.value;
      },
    },
    {
      name: "weatherExponent",
      params: {
        min: 0,
        max: 3,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].weatherExponent =
          v.value;
      },
    },
    {
      name: "shapeAlteringBias",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].shapeAlteringBias =
          v.value;
      },
    },
    {
      name: "coverageFilterWidth",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].coverageFilterWidth =
          v.value;
      },
    },
    {
      name: "shadow",
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].shadow = v.value;
      },
    },
    {
      name: "expTerm",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].expTerm = v.value;
      },
    },
    {
      name: "exponent",
      params: {
        min: 0,
        max: 10,
        step: 0.02,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].exponent = v.value;
      },
    },
    {
      name: "linearTerm",
      params: {
        min: -2,
        max: 2,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].linearTerm = v.value;
      },
    },
    {
      name: "constantTerm",
      params: {
        min: -2,
        max: 2,
        step: 0.01,
      },
      onChange: (v) => {
        if (!cloudsLayer) return;
        cloudsLayer.cloudLayers[CLOUD_LAYERS_PARAMS.index].constantTerm =
          v.value;
      },
    },
  ];

  const folder = pane.addFolder({
    title: "Clouds",
  });

  addFieldsToFolder(folder, BASE_PARAMS, baseFields);
  addFieldsToFolder(
    folder.addFolder({ title: "Shadow", expanded: false }),
    SHADOW_PARAMS,
    shadowFields,
  );
  addFieldsToFolder(
    folder.addFolder({ title: "Haze", expanded: false }),
    HAZE_PARAMS,
    hazeFields,
  );
  addFieldsToFolder(
    folder.addFolder({ title: "Weather and shape", expanded: false }),
    WEATHER_AND_SHAPE_PARAMS,
    weatherAndShapeFields,
  );
  addFieldsToFolder(
    folder.addFolder({ title: "Scattering", expanded: false }),
    SCATTERING_PARAMS,
    scatteringFields,
  );
  addFieldsToFolder(
    folder.addFolder({ title: "Cloud layers", expanded: false }),
    CLOUD_LAYERS_PARAMS,
    cloudLayersFields,
  );
};

const addAAControl = (pane: Pane, defaultEffects: DefaultEffects) => {
  const PARAMS = {
    enable: false,
    effect: "smaa",
    quality: "medium",
    edgeDetectionMode: "color",
  } as const;

  defaultEffects.smaa.update({
    visible: PARAMS.enable,
    smaa: {
      quality: PARAMS.quality,
      edgeDetectionMode: PARAMS.edgeDetectionMode,
    },
  });

  const folder = pane.addFolder({
    title: "Antialias",
  });

  folder.addBinding(PARAMS, "enable").on("change", (v) => {
    defaultEffects.smaa.update({ visible: v.value });
  });
  folder
    .addBinding(PARAMS, "effect", {
      options: Object.fromEntries(["smaa", "fxaa"].map((k) => [k, k])),
    })
    .on("change", (_v) => {
      // view.aaEffect.effect = v.value;
    });
  folder
    .addBinding(PARAMS, "quality", {
      options: Object.fromEntries(
        ["ultra", "high", "medium", "low"].map((k) => [k, k]),
      ),
    })
    .on("change", (v) => {
      defaultEffects.smaa.update({ smaa: { quality: v.value } });
    });
  folder
    .addBinding(PARAMS, "edgeDetectionMode", {
      options: Object.fromEntries(
        ["depth", "luma", "color"].map((k) => [k, k]),
      ),
    })
    .on("change", (v) => {
      defaultEffects.smaa.update({ smaa: { edgeDetectionMode: v.value } });
    });
};

// Advanced
const addIBLControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    enable: false,
    sh: "debug",
    intensity: 1,
  };

  const sh = new SphericalHarmonics3();
  sh.coefficients = SH_COEFFICIENTS.debug;

  // Create the light probe layer but keep it hidden initially
  const lightProbeLayer = view.addLayer<LightProbeLayer>({
    type: "light",
    lightProbe: {
      sh: sh,
      intensity: PARAMS.intensity,
    },
    visible: false,
  });

  const folder = pane.addFolder({
    title: "Image-based lighting",
  });

  folder.addBinding(PARAMS, "enable").on("change", (v) => {
    lightProbeLayer.update({
      visible: v.value,
    });
    view.forceUpdate();
  });
  folder
    .addBinding(PARAMS, "sh", {
      options: Object.fromEntries(
        Object.entries(SH_COEFFICIENTS).map(([k]) => [k, k]),
      ),
    })
    .on("change", (v) => {
      sh.coefficients =
        SH_COEFFICIENTS[v.value as keyof typeof SH_COEFFICIENTS];
      lightProbeLayer.update({
        lightProbe: {
          sh: sh,
        },
      });
      view.forceUpdate();
    });
  folder.addBinding(PARAMS, "intensity").on("change", (v) => {
    lightProbeLayer.update({
      lightProbe: {
        intensity: v.value,
      },
    });
    view.forceUpdate();
  });
};

const addEffectsControl = (
  view: ThreeView,
  pane: Pane,
  defaultEffects: DefaultEffects,
) => {
  const PARAMS = {
    toneMapping: true,
    toneMappingMode: ToneMappingMode.AGX,
    toneMappingExposure: 10,
    lensFlare: true,
    lensFlareIntensity: 0.005,
    dithering: true,
    ssao: false,
    ssaoHalfRes: true,
    ssaoQuality: "Low",
    ssaoSamples: 16,
    ssaoRadius: 5,
    ssaoIntensity: 1,
    ssaoColor: "#000000",
  };

  defaultEffects.toneMapping.update({
    visible: PARAMS.toneMapping,
    toneMapping: { mode: PARAMS.toneMappingMode },
  });
  view.toneMappingExposure = PARAMS.toneMappingExposure;
  defaultEffects.lensFlare.update({
    visible: PARAMS.lensFlare,
    lensFlare: { intensity: PARAMS.lensFlareIntensity },
  });

  const ssao = view.addLayer<SSAOEffectLayer>({
    type: "effect",
    visible: PARAMS.ssao,
    ssao: {},
  });

  const folder = pane.addFolder({
    title: "Effects",
  });

  folder.addBinding(PARAMS, "toneMapping").on("change", (v) => {
    defaultEffects.toneMapping.update({ visible: v.value });
  });
  folder
    .addBinding(PARAMS, "toneMappingMode", {
      options: ToneMappingMode,
    })
    .on("change", (v) => {
      defaultEffects.toneMapping.update({
        toneMapping: { mode: Number(v.value) },
      });
    });
  folder
    .addBinding(PARAMS, "toneMappingExposure", { min: 0, max: 20, steps: 1 })
    .on("change", (v) => {
      view.toneMappingExposure = v.value;
    });
  folder.addBinding(PARAMS, "lensFlare").on("change", (v) => {
    defaultEffects.lensFlare.update({ visible: v.value });
  });
  folder
    .addBinding(PARAMS, "lensFlareIntensity", { step: 0.001 })
    .on("change", (v) => {
      defaultEffects.lensFlare.update({ lensFlare: { intensity: v.value } });
    });
  folder.addBinding(PARAMS, "ssao").on("change", (v) => {
    ssao.update({ visible: v.value });
  });
  folder.addBinding(PARAMS, "ssaoHalfRes").on("change", (v) => {
    ssao.update({ ssao: { halfRes: v.value } });
  });
  folder
    .addBinding(PARAMS, "ssaoQuality", {
      options: ["Ultra", "High", "Medium", "Low"].map((v) => ({
        text: v,
        value: v,
      })),
    })
    .on("change", (v) => {
      ssao.update({
        ssao: { quality: v.value as SSAOQualityMode },
      });
    });
  folder.addBinding(PARAMS, "ssaoSamples").on("change", (v) => {
    ssao.update({ ssao: { samples: v.value } });
  });
  folder.addBinding(PARAMS, "ssaoRadius").on("change", (v) => {
    ssao.update({ ssao: { radius: v.value } });
  });
  folder.addBinding(PARAMS, "ssaoIntensity").on("change", (v) => {
    ssao.update({ ssao: { intensity: v.value } });
  });
  folder.addBinding(PARAMS, "ssaoColor").on("change", (v) => {
    ssao.update({ ssao: { color: new Color(v.value) } });
  });
};
