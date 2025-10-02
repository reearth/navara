import { EventHandler } from "@navara/core";
import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerHandle,
  type LightProbeLayer,
  type SkyLightProbeLayer,
  type StarsLayer,
  type FogLightEffectLayer,
  type LayerDescription,
  type FogLightDefinition,
  degreeToRadian,
  geodeticToVector3,
  LLE,
} from "@navara/three";
import type { FeatureCollection, Point } from "geojson";
import * as THREE from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export const run = async (view: ThreeView) => {
  await view.init();

  // Night scene configuration
  view.toneMappingExposure = 10;

  // Set background to dark night sky
  // Note: Background should be set through renderer or effect layers, not scene directly

  // Add default effect layers
  view.addDefaultEffectLayers();

  // Configure atmosphere for night scene
  const defaultAtmosphere = view.addDefaultAtmosphereLayers();
  defaultAtmosphere.sun.update({
    sun: {
      castShadow: true,
    },
  });

  defaultAtmosphere.stars.update({
    stars: {
      intensity: 50,
      pointSize: 2,
    },
  });

  // Set time to night (10 PM)
  const nightDate = new Date();
  nightDate.setHours(22);

  // Add sky light probe for night ambient lighting
  defaultAtmosphere.skyLightProbe.update({
    skyLightProbe: {
      intensity: 1,
    },
  });

  // Add raster tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
    },
  });

  // Add terrain
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 6,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      receive_shadow: true,
      cast_shadow: true,
    },
  });

  // Create controls panel
  const pane = new Pane({ title: "Night Scene Example" });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  // Camera controls
  addCameraControl(view, pane, () => {
    pane
      .addButton({
        title: "Takanawa view",
      })
      .on("click", () => {
        view.setCamera({
          lng: 139.7597808838,
          lat: 35.6186485291,
          height: 1106.74,
          heading: 315.9337768555,
          pitch: -23.1623802185,
          roll: 0.0,
        });
      });
  });

  // Add 3D Tiles scene switcher and fog light control
  const sceneChangeHandler = add3DTilesSceneControl(view, pane);

  // Date/Time controls for sun position
  addDateControl(view, pane, nightDate);

  // Night light probe intensity control
  addNightLightProbeControl(view, pane);

  // Stars controls
  addStarsControl(view, defaultAtmosphere.stars, pane);

  // Sky Light Probe controls
  addSkyLightProbeControl(view, defaultAtmosphere.skyLightProbe, pane);

  // Add independent Tokyo Points control with its own fog light
  addTokyoPointsFogLightControl(view, pane);

  // Fog Light controls for 3D Tiles scenes
  addFogLightControl(view, pane, sceneChangeHandler);
};

const addNightLightProbeControl = (view: ThreeView, pane: Pane) => {
  const lightProbeLayer = view.addLayer<LightProbeLayer>({
    type: "light",
    lightProbe: {
      sh: new THREE.SphericalHarmonics3().set(SH_COEFFICIENTS.night),
      intensity: 0.05,
    },
  });

  const lightProbeFolder = pane.addFolder({
    title: "Night Light Probe",
    expanded: true,
  });

  const lightProbeParams = {
    intensity: 0.05,
  };

  view.atmosphere.on("sunChanged", () => {
    const isAtNight = view.atmosphere.isAtNight(view.camera.raw.position);
    lightProbeLayer.update({
      visible: isAtNight,
    });
  });

  lightProbeFolder
    .addBinding(lightProbeParams, "intensity", {
      min: 0,
      max: 0.5,
      step: 0.001,
    })
    .on("change", (ev) => {
      lightProbeLayer.update({
        lightProbe: { intensity: ev.value },
      });
    });

  return lightProbeFolder;
};

const addStarsControl = (
  view: ThreeView,
  starsLayer: LayerHandle<StarsLayer>,
  pane: Pane,
) => {
  const starsFolder = pane.addFolder({
    title: "Stars",
    expanded: true,
  });

  const starsParams = {
    intensity: 50,
    pointSize: 2,
  };

  view.atmosphere.on("sunChanged", () => {
    const isNight = view.atmosphere.isAtNight(view.camera.raw.position);
    starsLayer.update({
      stars: {
        intensity: isNight ? starsParams.intensity : 1,
        pointSize: isNight ? starsParams.pointSize : 1,
      },
    });
  });

  starsFolder
    .addBinding(starsParams, "intensity", {
      min: 0,
      max: 200,
      step: 1,
    })
    .on("change", (ev) => {
      starsLayer.update({
        stars: { intensity: ev.value },
      });
    });

  starsFolder
    .addBinding(starsParams, "pointSize", {
      min: 0.1,
      max: 10,
      step: 0.1,
    })
    .on("change", (ev) => {
      starsLayer.update({
        stars: { pointSize: ev.value },
      });
    });

  return starsFolder;
};

const addSkyLightProbeControl = (
  view: ThreeView,
  skyLightProbeLayer: LayerHandle<SkyLightProbeLayer>,
  pane: Pane,
) => {
  const skyLightProbeFolder = pane.addFolder({
    title: "Sky Light Probe",
    expanded: true,
  });

  const skyLightProbeParams = {
    intensity: 1,
    nightIntensity: 5,
  };

  // Function to update intensity based on time of day
  const updateIntensity = () => {
    const isAtNight = view.atmosphere.isAtNight(view.camera.raw.position);
    const intensity = isAtNight
      ? skyLightProbeParams.nightIntensity
      : skyLightProbeParams.intensity;
    skyLightProbeLayer.update({
      skyLightProbe: { intensity },
    });
  };

  // Listen for sun changes
  view.atmosphere.on("sunChanged", updateIntensity);

  // Day intensity control
  skyLightProbeFolder
    .addBinding(skyLightProbeParams, "intensity", {
      min: 0,
      max: 5,
      step: 0.01,
      label: "Day Intensity",
    })
    .on("change", () => {
      updateIntensity();
    });

  // Night intensity control
  skyLightProbeFolder
    .addBinding(skyLightProbeParams, "nightIntensity", {
      min: 0,
      max: 100,
      step: 1,
      label: "Night Intensity",
    })
    .on("change", () => {
      updateIntensity();
    });

  // Initial update
  updateIntensity();

  return skyLightProbeFolder;
};

const add3DTilesSceneControl = (view: ThreeView, pane: Pane) => {
  const SCENES = {
    "Chiyoda & Chuo": {
      tiles: [
        {
          url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
          name: "Chiyoda",
        },
        {
          url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
          name: "Chuo",
        },
      ],
      lightDataFile: "/street_light.geojson",
    },
    Takanawa: {
      tiles: [
        {
          url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
          name: "Takanawa",
        },
      ],
      lightDataFile: "/takanawa_point_light.geojson",
    },
  };

  const PARAMS = {
    scene: "Chiyoda & Chuo" as keyof typeof SCENES,
  };

  // Create event handler for scene changes
  const sceneChangeHandler = new EventHandler();

  // Track current layers
  let currentLayers: ReturnType<typeof view.addLayer>[] = [];

  // Function to clear current 3D tiles
  const clearCurrentTiles = () => {
    currentLayers.forEach((layer) => layer.delete());
    currentLayers = [];
  };

  // Function to load new scene
  const loadScene = (sceneName: keyof typeof SCENES) => {
    clearCurrentTiles();

    const sceneData = SCENES[sceneName];
    sceneData.tiles.forEach((tile) => {
      const description: LayerDescription = {
        type: "cesium3dtiles",
        data: {
          url: tile.url,
        },
        model: {
          show: true,
          id_property: "gml_id",
          color: 0xffffff,
          metalness: 0.2,
          roughness: 0.8,
          height: -50,
          cast_shadow: true,
          receive_shadow: true,
        },
      };
      const layer = view.addLayer(description);
      currentLayers.push(layer);
    });
  };

  // Load initial scene
  loadScene(PARAMS.scene);

  // Add control to pane
  const folder = pane.addFolder({
    title: "3D Tiles Scene",
    expanded: true,
  });

  folder
    .addBinding(PARAMS, "scene", {
      options: Object.keys(SCENES).reduce(
        (acc, key) => {
          acc[key] = key;
          return acc;
        },
        {} as Record<string, string>,
      ),
    })
    .on("change", (v) => {
      const sceneName = v.value as keyof typeof SCENES;
      loadScene(sceneName);
      // Emit scene change event with light data file
      sceneChangeHandler.emit("sceneChanged", {
        scene: sceneName,
        lightDataFile: SCENES[sceneName].lightDataFile,
      });
    });

  return sceneChangeHandler;
};

type StreetLightFeature = FeatureCollection<
  Point,
  {
    height?: number;
    color?: number;
    intensity?: number;
    radius?: number;
  }
>;

// Common function to load GeoJSON light data and convert to 3D positions
const loadGeoJSONLights = async (
  url: string,
): Promise<FogLightDefinition[]> => {
  try {
    const response = await fetch(url);
    const geojson: StreetLightFeature = await response.json();

    return geojson.features.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const altitude = feature.properties?.height || 10;

      const lle = new LLE(degreeToRadian(lat), degreeToRadian(lon), altitude);
      const position = geodeticToVector3(lle);

      return {
        position: { x: position.x, y: position.y, z: position.z },
        color: feature.properties?.color || 0xffaa55,
        intensity: feature.properties?.intensity || 1.0,
        radius: feature.properties?.radius ?? 500,
      };
    });
  } catch (error) {
    console.warn(`Failed to load GeoJSON data from ${url}:`, error);
    return [];
  }
};

const addTokyoPointsFogLightControl = async (view: ThreeView, pane: Pane) => {
  // Load Tokyo Points light data using common function
  const tokyoPointsLights = await loadGeoJSONLights(
    "/tokyo_points_100.geojson",
  );

  // Create separate fog light layer for Tokyo Points
  const tokyoPointsFogLayer = view.addLayer<FogLightEffectLayer>({
    type: "effect",
    fogLight: {
      lights: tokyoPointsLights,
      fogDensity: 2.0, // Different default density for Tokyo Points
      useSurfaceLighting: true,
      maxFar: view.camera.raw.far,
    },
    visible: false, // Initially hidden
  });

  // Create UI folder for Tokyo Points
  const folder = pane.addFolder({
    title: "Tokyo Points Fog Light",
    expanded: true,
  });

  const params = {
    visible: false,
    fogDensity: 2.0,
    lightsIntensity: 1.0,
    lightsRadius: 500,
    useSurfaceLighting: true,
    // Newly exposed tuning params
    downsample: 2,
    tileSize: 32,
    maxLightsPerTile: 64,
    extentScale: 0.8,
    debugShowGrid: false,
    maxLights: 200,
    maxFar: view.camera.raw.far,
  };

  // Visibility control
  folder
    .addBinding(params, "visible", {
      label: "Enable",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({
        visible: ev.value,
      });
    });

  // Fog density control
  folder
    .addBinding(params, "fogDensity", {
      min: 0,
      max: 20,
      step: 0.1,
      label: "Fog Density",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({
        fogLight: { fogDensity: ev.value },
      });
    });

  // Lights intensity control
  folder
    .addBinding(params, "lightsIntensity", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Lights Intensity",
    })
    .on("change", (ev) => {
      const updatedLights = tokyoPointsLights.map((light) => ({
        ...light,
        intensity: ev.value,
      }));
      tokyoPointsFogLayer.update({
        fogLight: { lights: updatedLights },
      });
    });

  // Lights radius control
  folder
    .addBinding(params, "lightsRadius", {
      min: 0,
      max: 5000,
      step: 10,
      label: "Lights Radius",
    })
    .on("change", (ev) => {
      const updatedLights = tokyoPointsLights.map((light) => ({
        ...light,
        radius: ev.value,
      }));
      tokyoPointsFogLayer.update({
        fogLight: { lights: updatedLights },
      });
    });

  // Surface lighting toggle
  folder
    .addBinding(params, "useSurfaceLighting", {
      label: "Surface Lighting",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({
        fogLight: { useSurfaceLighting: ev.value },
      });
    });

  // Downsample factor (1: full, 2: half, 4: quarter)
  folder
    .addBinding(params, "downsample", {
      min: 1,
      max: 4,
      step: 1,
      label: "Downsample",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({ fogLight: { downsample: ev.value } });
    });

  // Max lights per tile
  folder
    .addBinding(params, "maxLightsPerTile", {
      min: 16,
      max: 256,
      step: 16,
      label: "Max Lights/Tile",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({
        fogLight: { maxLightsPerTile: ev.value },
      });
    });

  // Extent scale
  folder
    .addBinding(params, "extentScale", {
      min: 0.1,
      max: 5,
      step: 0.05,
      label: "Extent Scale",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({ fogLight: { extentScale: ev.value } });
    });

  // Max far culling distance
  folder
    .addBinding(params, "maxFar", {
      min: 100,
      max: 1e7,
      step: 10000,
      label: "Cull Distance (maxFar)",
    })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({ fogLight: { maxFar: ev.value } });
    });

  // Debug: show grid
  folder
    .addBinding(params, "debugShowGrid", { label: "Debug Grid" })
    .on("change", (ev) => {
      tokyoPointsFogLayer.update({ fogLight: { debugShowGrid: ev.value } });
    });

  return folder;
};

const addFogLightControl = async (
  view: ThreeView,
  pane: Pane,
  sceneChangeHandler?: EventHandler,
) => {
  // Fetch street light data and add fog light effect
  let fogLightLayer: LayerHandle<FogLightEffectLayer> | undefined;
  let streetLights: FogLightDefinition[] = [];

  // Function to load light data from a file using common function
  const loadLightData = async (lightDataFile: string) => {
    streetLights = await loadGeoJSONLights(lightDataFile);

    // Update or create fog light layer
    if (fogLightLayer) {
      fogLightLayer.update({
        fogLight: {
          lights: streetLights,
        },
      });
    } else {
      // Create fog light layer, initially visible only at night
      const isAtNight = view.atmosphere.isAtNight(view.camera.raw.position);
      fogLightLayer = view.addLayer<FogLightEffectLayer>({
        type: "effect",
        fogLight: {
          lights: streetLights,
          fogDensity: 0.5,
          useSurfaceLighting: true,
          maxFar: view.camera.raw.far,
        },
        visible: isAtNight,
      });
    }
  };

  // Load initial light data
  await loadLightData("/street_light.geojson");

  // Listen for scene changes if handler provided
  if (sceneChangeHandler) {
    sceneChangeHandler.on(
      "sceneChanged",
      async (data: { scene: string; lightDataFile: string }) => {
        await loadLightData(data.lightDataFile);
      },
    );
  }

  const fogLightFolder = pane.addFolder({
    title: "Scene Fog Light",
    expanded: true,
  });

  const fogLightParams = {
    fogDensity: 0.5,
    useSurfaceLighting: true,
    lightsIntensity: 1.0,
    lightsRadius: 500,
    enableAtNight: true,
    // Newly exposed tuning params
    downsample: 2,
    tileSize: 32,
    maxLightsPerTile: 64,
    extentScale: 0.8,
    debugShowGrid: false,
    maxLights: 200,
    maxFar: view.camera.raw.far,
  };

  // Function to update visibility based on time of day
  const updateVisibility = () => {
    if (fogLightLayer && fogLightParams.enableAtNight) {
      const isAtNight = view.atmosphere.isAtNight(view.camera.raw.position);
      fogLightLayer.update({
        visible: isAtNight,
      });
    }
  };

  // Listen for sun changes to update visibility
  view.atmosphere.on("sunChanged", updateVisibility);

  // Fog density control
  fogLightFolder
    .addBinding(fogLightParams, "fogDensity", {
      min: 0,
      max: 20,
      step: 0.1,
      label: "Fog Density",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({
          fogLight: { fogDensity: ev.value },
        });
      }
    });

  // Surface lighting toggle
  fogLightFolder
    .addBinding(fogLightParams, "useSurfaceLighting", {
      label: "Surface Lighting",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({
          fogLight: { useSurfaceLighting: ev.value },
        });
      }
    });

  // Downsample factor (1: full, 2: half, 4: quarter)
  fogLightFolder
    .addBinding(fogLightParams, "downsample", {
      min: 1,
      max: 4,
      step: 1,
      label: "Downsample",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({ fogLight: { downsample: ev.value } });
      }
    });

  // Max lights per tile
  fogLightFolder
    .addBinding(fogLightParams, "maxLightsPerTile", {
      min: 16,
      max: 256,
      step: 16,
      label: "Max Lights/Tile",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({ fogLight: { maxLightsPerTile: ev.value } });
      }
    });

  // Extent scale
  fogLightFolder
    .addBinding(fogLightParams, "extentScale", {
      min: 0.1,
      max: 5,
      step: 0.05,
      label: "Extent Scale",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({ fogLight: { extentScale: ev.value } });
      }
    });

  // Max far culling distance
  fogLightFolder
    .addBinding(fogLightParams, "maxFar", {
      min: 100,
      max: 1e7,
      step: 10000,
      label: "Cull Distance (maxFar)",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({ fogLight: { maxFar: ev.value } });
      }
    });

  // Debug: show grid
  fogLightFolder
    .addBinding(fogLightParams, "debugShowGrid", { label: "Debug Grid" })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({ fogLight: { debugShowGrid: ev.value } });
      }
    });

  // Lights intensity control (updates all lights)
  fogLightFolder
    .addBinding(fogLightParams, "lightsIntensity", {
      min: 0,
      max: 10,
      step: 0.1,
      label: "Lights Intensity",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        const updatedLights = streetLights.map((light) => ({
          ...light,
          intensity: ev.value,
        }));
        fogLightLayer.update({
          fogLight: { lights: updatedLights },
        });
      }
    });

  // Lights radius control (updates all lights)
  fogLightFolder
    .addBinding(fogLightParams, "lightsRadius", {
      min: 0,
      max: 5000,
      step: 10,
      label: "Lights Radius",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        const updatedLights = streetLights.map((light) => ({
          ...light,
          radius: ev.value,
        }));
        fogLightLayer.update({
          fogLight: { lights: updatedLights },
        });
      }
    });

  // Enable at Night control
  fogLightFolder
    .addBinding(fogLightParams, "enableAtNight", {
      label: "Enable at Night",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        if (ev.value) {
          // When enabled, check current time and update visibility
          updateVisibility();
        } else {
          // When disabled, always show the fog lights
          fogLightLayer.update({
            visible: true,
          });
        }
      }
    });

  // Initial visibility update
  updateVisibility();

  return fogLightFolder;
};
