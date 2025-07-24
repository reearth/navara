import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  LayerHandle,
  RainMeshLayer,
  SnowMeshLayer,
  ThreeVec3,
} from "@navara/three";
import { degreeToRadian, geodeticToVector3, LLE } from "@navara/three_api";
import { Vector2 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.setCamera({
    lng: 139.7371145474829,
    lat: 35.67564356091717,
    height: 502.0,
    heading: 64.41840149763287, // -180 to 180
    pitch: -16.00000121921312, // -180 to 0
    roll: 0, // -180 to 180
  });

  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  view.aerialPerspective.irradiance = true;

  view.cloudsEffect.localWeatherVelocity = new Vector2(0.005, 0.001);
  view.cloudsEffect.coverage = 0.35;
  view.cloudsEffect.absorptionCoefficient = 15;
  view.cloudsEffect.lightShafts = true;
  view.cloudsEffect.shadows = true;

  view.toneMappingEffect.enabled = true;
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
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addDateControl(view, pane);
  addWeatherControl(view, pane);
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
    position: ThreeVec3.fromRaw(position),
    rain: {
      opacity: 1,
    },
  });
  const snow = view.addLayer<SnowMeshLayer>({
    type: "mesh",
    visible: false,
    position: ThreeVec3.fromRaw(position),
    snow: {
      opacity: 1,
    },
  });

  type WeatherType = "sunny" | "rainy" | "snowy";

  const PARAMS = {
    weather: "sunny" as WeatherType,
    followCamera: false,
    renderAsAtmosphere: false,
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
    {
      name: "followCamera",
      onChange: (v) => {
        rain.update({
          rain: {
            followCamera: v.value,
          },
        });
        snow.update({
          snow: {
            followCamera: v.value,
          },
        });

        if (!v.value) {
          rain.update({
            position: ThreeVec3.fromRaw(position),
          });
          snow.update({
            position: ThreeVec3.fromRaw(position),
          });
        }
      },
    },
  ];

  const folder = pane.addFolder({
    title: "Weather",
  });
  addFieldsToFolder(folder, PARAMS, folderFields);

  // Rain

  const RAIN_PARAMS = {
    opacity: 1.0,
    particleCount: rain.ref?.particleCount,
    speed: rain.ref?.speed,
    color: rain.ref?.color,
    width: rain.ref?.width,
    height: rain.ref?.height,
    areaWidth: rain.ref?.areaWidth,
    areaHeight: rain.ref?.areaHeight,
    maxHeight: rain.ref?.maxHeight,
    diffuse: rain.ref?.diffuse,
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
      name: "diffuse",
      onChange: (v) => {
        rain.update({
          rain: {
            diffuse: v.value,
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
    opacity: 1.0,
    particleCount: snow.ref?.particleCount,
    speed: snow.ref?.speed,
    size: snow.ref?.size,
    color: snow.ref?.color,
    areaWidth: snow.ref?.areaWidth,
    areaHeight: snow.ref?.areaHeight,
    maxHeight: snow.ref?.maxHeight,
    xMovementStrength: snow.ref?.xMovementStrength,
    xMovementSpeed: snow.ref?.xMovementSpeed,
    yMovementStrength: snow.ref?.yMovementStrength,
    yMovementSpeed: snow.ref?.yMovementSpeed,
    zMovementStrength: snow.ref?.zMovementStrength,
    zMovementSpeed: snow.ref?.zMovementSpeed,
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
            xMovementStrength: v.value,
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
            xMovementSpeed: v.value,
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
            yMovementStrength: v.value,
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
            yMovementSpeed: v.value,
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
            zMovementStrength: v.value,
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
            zMovementSpeed: v.value,
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
