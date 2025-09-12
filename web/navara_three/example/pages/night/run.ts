import { EventHandler } from "@navara/core";
import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerHandle,
  type LightProbeLayer,
  type SkyLightProbeLayer,
  type StarsLayer,
  type FogLightEffectLayer,
  type LayerDescription,
} from "@navara/three";
import { degreeToRadian, geodeticToVector3, LLE } from "@navara/three_api";
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

  view.addLayer({
    type: "effect",
    ssao: {
      intensity: 2,
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
        roll: 0.00,
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

  // Fog Light controls
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
  // Define the two scenes with their light data files
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
    "Takanawa": {
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
        lightDataFile: SCENES[sceneName].lightDataFile 
      });
    });

  return sceneChangeHandler;
};

const addFogLightControl = async (
  view: ThreeView,
  pane: Pane,
  sceneChangeHandler?: EventHandler,
) => {
  // Fetch street light data and add fog light effect
  let fogLightLayer: LayerHandle<FogLightEffectLayer> | undefined;
  let streetLights: {
    position: { x: number; y: number; z: number };
    color: number;
    intensity: number;
  }[] = [];

  // Function to load light data from a file
  const loadLightData = async (lightDataFile: string) => {
    try {
      const response = await fetch(lightDataFile);
      const geojson = await response.json();

    // Convert GeoJSON coordinates to Vector3
    type StreetLightFeature = {
      geometry: { coordinates: [number, number] };
      properties?: {
        height?: number;
        color?: number;
        intensity?: number;
      };
    };

      streetLights = geojson.features.map((feature: StreetLightFeature) => {
        const [lon, lat] = feature.geometry.coordinates;
        const altitude = feature.properties?.height || 10; // Default 10m height for street lights

        // Convert geodetic coordinates to 3D vector
        const lle = new LLE(degreeToRadian(lat), degreeToRadian(lon), altitude);
        const position = geodeticToVector3(lle);

        return {
          position: { x: position.x, y: position.y, z: position.z },
          color: feature.properties?.color || 0xffaa55, // Warm street light color
          intensity: feature.properties?.intensity || 1.0,
        };
      });

      // Update or create fog light layer
      if (fogLightLayer) {
        fogLightLayer.update({
          fogLight: {
            lights: streetLights,
          },
        });
      } else {
        fogLightLayer = view.addLayer<FogLightEffectLayer>({
          type: "effect",
          fogLight: {
            lights: streetLights,
            fogDensity: 5,
            useSurfaceLighting: true,
          },
        });
      }
    } catch (error) {
      console.warn(
        `Failed to load light data from ${lightDataFile}:`,
        error,
      );
    }
  };

  // Load initial light data
  await loadLightData("/street_light.geojson");

  // Listen for scene changes if handler provided
  if (sceneChangeHandler) {
    sceneChangeHandler.on("sceneChanged", async (data: { scene: string; lightDataFile: string }) => {
      await loadLightData(data.lightDataFile);
    });
  }

  const fogLightFolder = pane.addFolder({
    title: "Fog Light",
    expanded: true,
  });

  const fogLightParams = {
    fogDensity: 5,
    useSurfaceLighting: true,
    lightsIntensity: 2.0,
    visible: true,
  };

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

  // Visibility control
  fogLightFolder
    .addBinding(fogLightParams, "visible", {
      label: "Visible",
    })
    .on("change", (ev) => {
      if (fogLightLayer) {
        fogLightLayer.update({
          visible: ev.value,
        });
      }
    });

  return fogLightFolder;
};
