import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerHandle,
  type LightProbeLayer,
  type SkyLightProbeLayer,
  type StarsLayer,
} from "@navara/three";
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
      intensity: 2
    }
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

  // Add 3D tiles buildings with night lighting
  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
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
  });

  // Create controls panel
  const pane = new Pane({ title: "Night Scene Example" });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  // Camera controls
  addCameraControl(view, pane);

  // Date/Time controls for sun position
  addDateControl(view, pane, nightDate);

  // Night light probe intensity control
  addNightLightProbeControl(view, pane);

  // Stars controls
  addStarsControl(defaultAtmosphere.stars, pane);

  // Sky Light Probe controls
  addSkyLightProbeControl(view, defaultAtmosphere.skyLightProbe, pane);
};

const addNightLightProbeControl = (
  view: ThreeView,
  pane: Pane,
) => {
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

const addStarsControl = (starsLayer: LayerHandle<StarsLayer>, pane: Pane) => {
  const starsFolder = pane.addFolder({
    title: "Stars",
    expanded: true,
  });

  const starsParams = {
    intensity: 50,
    pointSize: 2,
  };

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
