import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  RainMesh,
  SnowMesh,
} from "@navara/three";
import { degreeToRadian, geodeticToVector3, LLE } from "@navara/three_api";
import { Vector2 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

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

  view.cloudsEffect.enabled = true;
  view.cloudsEffect.shadows = true;
  if (view.cloudsEffect) {
    view.cloudsEffect.localWeatherVelocity = new Vector2(0.005, 0.001);
    view.cloudsEffect.coverage = 0.35;
    view.cloudsEffect.absorptionCoefficient = 15;
    view.cloudsEffect.lightShafts = false;
  }

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
  const rain = new RainMesh({ opacity: 1 });
  const snow = new SnowMesh({ opacity: 1 });

  type WeatherType = "sunny" | "rainy" | "snowy";

  const PARAMS = {
    weather: "sunny" as WeatherType,
    followCamera: false,
    renderAsAtmosphere: false,
  };

  const position = geodeticToVector3(
    new LLE(
      degreeToRadian(35.67564356091717),
      degreeToRadian(139.74511454748298),
      10,
    ),
  );

  view.on("postRender", (t) => {
    switch (PARAMS.weather) {
      case "rainy": {
        rain.update(t, view.camera.innerCam, view.atmosphere.sunDirection);
        break;
      }
      case "snowy": {
        snow.update(t, view.camera.innerCam);
        break;
      }
    }
  });

  let selectedMesh: RainMesh | SnowMesh | null = null;

  const resetScenes = () => {
    if (!selectedMesh) return;
    view.scenes.opaque.remove(selectedMesh);
    view.scenes.transparent.remove(selectedMesh);
  };

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
        resetScenes();
        switch (v.value) {
          case "sunny": {
            selectedMesh = null;
            break;
          }
          case "rainy": {
            selectedMesh = rain;
            break;
          }
          case "snowy": {
            selectedMesh = snow;
            break;
          }
        }
        if (!selectedMesh) return;

        if (!PARAMS.followCamera) {
          selectedMesh.position.copy(position);
        }

        if (PARAMS.renderAsAtmosphere) {
          view.scenes.transparent.add(selectedMesh);
        } else {
          view.scenes.opaque.add(selectedMesh);
        }
      },
    },
    {
      name: "followCamera",
      onChange: (v) => {
        rain.followCamera = v.value;
        snow.followCamera = v.value;

        if (!v.value) {
          rain.position.copy(position);
          snow.position.copy(position);
        }
      },
    },
    {
      name: "renderAsAtmosphere",
      onChange: (v) => {
        if (!selectedMesh) return;

        resetScenes();

        if (v.value) {
          view.scenes.transparent.add(selectedMesh);
        } else {
          view.scenes.opaque.add(selectedMesh);
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
    particleCount: rain.particleCount,
    speed: rain.speed,
    color: rain.color,
    width: rain.width,
    height: rain.height,
    areaWidth: rain.areaWidth,
    areaHeight: rain.areaHeight,
    maxHeight: rain.maxHeight,
    diffuse: rain.diffuse,
  };

  const rainFolderFields: FolderFields<typeof RAIN_PARAMS> = [
    {
      name: "opacity",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        rain.opacity = v.value;
      },
    },
    {
      name: "particleCount",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.particleCount = v.value;
      },
    },
    {
      name: "speed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.speed = v.value;
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
        rain.color = v.value;
      },
    },
    {
      name: "width",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.width = v.value;
      },
    },
    {
      name: "height",
      params: {
        min: 0,
      },
      onChange: (v) => {
        rain.height = v.value;
      },
    },
    {
      name: "areaWidth",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.areaWidth = v.value;
      },
    },
    {
      name: "areaHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.areaHeight = v.value;
      },
    },
    {
      name: "maxHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        rain.maxHeight = v.value;
      },
    },
    {
      name: "diffuse",
      onChange: (v) => {
        rain.diffuse = v.value;
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
    particleCount: snow.particleCount,
    speed: snow.speed,
    size: snow.size,
    color: snow.color,
    areaWidth: snow.areaWidth,
    areaHeight: snow.areaHeight,
    maxHeight: snow.maxHeight,
    xMovementStrength: snow.xMovementStrength,
    xMovementSpeed: snow.xMovementSpeed,
    yMovementStrength: snow.yMovementStrength,
    yMovementSpeed: snow.yMovementSpeed,
    zMovementStrength: snow.zMovementStrength,
    zMovementSpeed: snow.zMovementSpeed,
  };

  const snowFolderFields: FolderFields<typeof SNOW_PARAMS> = [
    {
      name: "opacity",
      params: {
        min: 0,
        max: 1,
      },
      onChange: (v) => {
        snow.opacity = v.value;
      },
    },
    {
      name: "particleCount",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.particleCount = v.value;
      },
    },
    {
      name: "speed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.speed = v.value;
      },
    },
    {
      name: "size",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.size = v.value;
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
        snow.color = v.value;
      },
    },
    {
      name: "areaWidth",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.areaWidth = v.value;
      },
    },
    {
      name: "areaHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.areaHeight = v.value;
      },
    },
    {
      name: "maxHeight",
      params: {
        min: 100,
      },
      onChange: (v) => {
        snow.maxHeight = v.value;
      },
    },
    {
      name: "xMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.xMovementStrength = v.value;
      },
    },
    {
      name: "xMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.xMovementSpeed = v.value;
      },
    },
    {
      name: "yMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.yMovementStrength = v.value;
      },
    },
    {
      name: "yMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.yMovementSpeed = v.value;
      },
    },
    {
      name: "zMovementStrength",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.zMovementStrength = v.value;
      },
    },
    {
      name: "zMovementSpeed",
      params: {
        min: 0,
      },
      onChange: (v) => {
        snow.zMovementSpeed = v.value;
      },
    },
  ];

  const snowFolder = pane.addFolder({
    title: "Snow",
  });
  addFieldsToFolder(snowFolder, SNOW_PARAMS, snowFolderFields);
};
