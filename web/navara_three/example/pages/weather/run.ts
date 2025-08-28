import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  LayerHandle,
  RainMeshLayer,
  SnowMeshLayer,
  SSREffectLayer,
  CloudsEffectLayer,
  type LayerDescription,
} from "@navara/three";
import { degreeToRadian, geodeticToVector3, LLE } from "@navara/three_api";
import { Vector2, Vector3 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addDateControl, addHidePaneKeyShortcut } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultEffects = view.addDefaultEffectLayers();
  view.addDefaultAtmosphereLayers();

  // Add clouds effect layer explicitly
  const cloudsLayer = view.addLayer<CloudsEffectLayer>({
    type: "effect",
    clouds: {},
  });

  defaultEffects.aerialPerspective.update({
    aerialPerspective: {
      irradiance: true,
    },
  });

  view.addLayer<SSREffectLayer>({
    type: "effect",
    visible: true,
    ssr: {},
  });

  view.setCamera({
    lng: 139.7371145474829,
    lat: 35.67564356091717,
    height: 402.0,
    heading: 64.41840149763287, // -180 to 180
    pitch: -16.00000121921312, // -180 to 0
    roll: 0, // -180 to 180
  });

  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  cloudsLayer.update({
    clouds: {
      qualityPreset: "high",
      localWeatherVelocity: new Vector2(0.005, 0.001),
      coverage: 0.45,
      absorptionCoefficient: 5,
      lightShafts: true,
      shadows: true,
      haze: true,
      hazeDensityScale: 0.0003,
      hazeExponent: 0.002,
      hazeAbsorptionCoefficient: 1.5,
    },
  });

  view.toneMappingExposure = 10;

  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
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
      height: -50,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  addDateControl(view, pane);
  addCameraControl(view, pane);
  add3DTilesControl(view, pane);
  addWeatherControl(view, pane);
};

const add3DTilesControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    visible: true,
  };

  const description: LayerDescription = {
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/bc/d3b4bd-77dd-428f-9ab9-9d77546a702b/13_tokyo-to_pref_2023_citygml_1_op_fld_pref_sumidagaw-shingashigawa-ryuiki_3dtiles_l2_no_texture/tileset.json",
    },
    model: {
      show: true,
      color: 0xa9c5d6,
      metalness: 0.05,
      roughness: 0.3,
      receive_shadow: true,
      height: -20,
    },
  };

  const layer = view.addLayer(description);

  const folder = pane.addFolder({
    title: "Sumida River Flood Model",
  });

  folder.addBinding(PARAMS, "visible").on("change", (v) => {
    if (description.model) {
      description.model.show = v.value;
    }
    layer.update(description);
  });
};

const addCameraControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    autoRotation: false,
  };
  const folder = pane.addFolder({
    title: "Camera",
  });

  let frameId: number;
  folder.addBinding(PARAMS, "autoRotation").on("change", (v) => {
    if (!v.value) {
      cancelAnimationFrame(frameId);
      return;
    }

    const animateFunc = () => {
      view.rotateAroundAxis(new Vector3(0, 0, 0), 0.002);
      frameId = requestAnimationFrame(animateFunc);
    };
    animateFunc();
  });
};

const addWeatherControl = (view: ThreeView, pane: Pane) => {
  const position = geodeticToVector3(
    new LLE(
      degreeToRadian(35.67564356091717),
      degreeToRadian(139.74511454748298),
      10,
    ),
  );

  const rain = view.addLayer<RainMeshLayer>({
    type: "mesh",
    visible: false,
    position: position,
    rain: {},
  });
  const snow = view.addLayer<SnowMeshLayer>({
    type: "mesh",
    visible: false,
    position: position,
    snow: {},
  });

  type WeatherType = "sunny" | "rainy" | "snowy";

  const PARAMS = {
    weather: "sunny" as WeatherType,
  };

  let selectedLayer:
    | LayerHandle<RainMeshLayer>
    | LayerHandle<SnowMeshLayer>
    | null = null;

  const folderFields: FolderFields<typeof PARAMS> = [
    {
      name: "weather",
      params: {
        options: (["sunny", "rainy", "snowy"] as WeatherType[]).map((v) => ({
          text: v,
          value: v,
        })),
      },
      onChange: (v) => {
        switch (v.value) {
          case "sunny": {
            selectedLayer = null;
            break;
          }
          case "rainy": {
            selectedLayer = rain;
            break;
          }
          case "snowy": {
            selectedLayer = snow;
            break;
          }
        }

        rain.visible = false;
        snow.visible = false;

        if (!selectedLayer) return;

        selectedLayer.visible = true;
      },
    },
  ];

  const folder = pane.addFolder({
    title: "Weather",
  });
  addFieldsToFolder(folder, PARAMS, folderFields);

  // Rain

  const RAIN_PARAMS = {
    opacity: rain.ref?.raw?.opacity,
    particleCount: rain.ref?.raw?.particleCount,
    speed: rain.ref?.raw?.speed,
    color: rain.ref?.raw?.color,
    width: rain.ref?.raw?.width,
    height: rain.ref?.raw?.height,
    areaWidth: rain.ref?.raw?.areaWidth,
    areaHeight: rain.ref?.raw?.areaHeight,
    maxHeight: rain.ref?.raw?.maxHeight,
    alphaMax: rain.ref?.raw?.alphaMax,
    alphaMin: rain.ref?.raw?.alphaMin,
  };

  const rainFolderFields: FolderFields<typeof RAIN_PARAMS> = [
    {
      name: "opacity",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            opacity: v.value,
          },
        });
      },
    },
    {
      name: "particleCount",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            particleCount: v.value,
          },
        });
      },
    },
    {
      name: "speed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            speed: v.value,
          },
        });
      },
    },
    {
      name: "color",
      params: {
        color: {
          alpha: false,
          type: "int",
        },
      },
      onChange: (v) => {
        rain.update({
          rain: {
            color: v.value,
          },
        });
      },
    },
    {
      name: "width",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            width: v.value,
          },
        });
      },
    },
    {
      name: "height",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            height: v.value,
          },
        });
      },
    },
    {
      name: "areaWidth",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            areaWidth: v.value,
          },
        });
      },
    },
    {
      name: "areaHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            areaHeight: v.value,
          },
        });
      },
    },
    {
      name: "maxHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            maxHeight: v.value,
          },
        });
      },
    },
    {
      name: "alphaMax",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            alphaMax: v.value,
          },
        });
      },
    },
    {
      name: "alphaMin",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        rain.update({
          rain: {
            alphaMin: v.value,
          },
        });
      },
    },
  ];

  const rainFolder = pane.addFolder({
    title: "Rain",
  });
  addFieldsToFolder(rainFolder, RAIN_PARAMS, rainFolderFields);

  // Snow

  const SNOW_PARAMS = {
    opacity: snow.ref?.raw?.opacity,
    particleCount: snow.ref?.raw?.particleCount,
    speed: snow.ref?.raw?.speed,
    size: snow.ref?.raw?.size,
    color: snow.ref?.raw?.color,
    areaWidth: snow.ref?.raw?.areaWidth,
    areaHeight: snow.ref?.raw?.areaHeight,
    maxHeight: snow.ref?.raw?.maxHeight,
    xMovementStrength: snow.ref?.raw?.movementStrength.x ?? 0,
    xMovementSpeed: snow.ref?.raw?.movementSpeed.x ?? 0,
    yMovementStrength: snow.ref?.raw?.movementStrength.y ?? 0,
    yMovementSpeed: snow.ref?.raw?.movementSpeed.y ?? 0,
    zMovementStrength: snow.ref?.raw?.movementStrength.z ?? 0,
    zMovementSpeed: snow.ref?.raw?.movementSpeed.z ?? 0,
  };

  const snowFolderFields: FolderFields<typeof SNOW_PARAMS> = [
    {
      name: "opacity",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            opacity: v.value,
          },
        });
      },
    },
    {
      name: "particleCount",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            particleCount: v.value,
          },
        });
      },
    },
    {
      name: "speed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            speed: v.value,
          },
        });
      },
    },
    {
      name: "size",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            size: v.value,
          },
        });
      },
    },
    {
      name: "color",
      params: {
        color: {
          alpha: false,
          type: "int",
        },
      },
      onChange: (v) => {
        snow.update({
          snow: {
            color: v.value,
          },
        });
      },
    },
    {
      name: "areaWidth",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            areaWidth: v.value,
          },
        });
      },
    },
    {
      name: "areaHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            areaHeight: v.value,
          },
        });
      },
    },
    {
      name: "maxHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            maxHeight: v.value,
          },
        });
      },
    },
    {
      name: "xMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementStrength: {
              x: v.value,
              y: SNOW_PARAMS.yMovementStrength,
              z: SNOW_PARAMS.zMovementStrength,
            },
          },
        });
      },
    },
    {
      name: "xMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementSpeed: {
              x: v.value,
              y: SNOW_PARAMS.yMovementSpeed,
              z: SNOW_PARAMS.zMovementSpeed,
            },
          },
        });
      },
    },
    {
      name: "yMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementStrength: {
              x: SNOW_PARAMS.xMovementStrength,
              y: v.value,
              z: SNOW_PARAMS.zMovementStrength,
            },
          },
        });
      },
    },
    {
      name: "yMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementSpeed: {
              x: SNOW_PARAMS.xMovementSpeed,
              y: v.value,
              z: SNOW_PARAMS.zMovementSpeed,
            },
          },
        });
      },
    },
    {
      name: "zMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementStrength: {
              x: SNOW_PARAMS.xMovementStrength,
              y: SNOW_PARAMS.yMovementStrength,
              z: v.value,
            },
          },
        });
      },
    },
    {
      name: "zMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.update({
          snow: {
            movementSpeed: {
              x: SNOW_PARAMS.xMovementSpeed,
              y: SNOW_PARAMS.yMovementSpeed,
              z: v.value,
            },
          },
        });
      },
    },
  ];

  const snowFolder = pane.addFolder({
    title: "Snow",
  });
  addFieldsToFolder(snowFolder, SNOW_PARAMS, snowFolderFields);
};
