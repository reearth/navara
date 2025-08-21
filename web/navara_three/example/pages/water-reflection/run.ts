import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Pane } from "tweakpane";

import type { SSREffectLayer } from "../../../src/layers/effect";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

import { type ReflectiveBoxLayerConfig } from "./layers";

export const run = async (view: ThreeView<ReflectiveBoxLayerConfig>) => {
  await view.init();

  view.toneMappingExposure = 10;

  // Add default effect layers
  view.addDefaultEffectLayers();

  const defaultAtmosphere = view.addDefaultAtmosphereLayers();
  defaultAtmosphere.sun.update({
    sun: {
      castShadow: true,
    },
  });

  // Add SSR effect layer
  const ssrLayer = view.addLayer<SSREffectLayer>({
    type: "effect",
    visible: true,
    ssr: {},
  });

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
      min_zoom: 6,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
      receive_shadow: true,
      cast_shadow: true,
    },
  });

  // Add some 3D tiles buildings
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
      roughness: 0.5,
      height: -50,
      cast_shadow: true,
      receive_shadow: true,
    },
  });

  // Add water polygons using GeoJSON with reflection
  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        coordinates: [
          [
            [139.64114960199845, 35.77501909535009],
            [139.64114960199845, 35.6170718697025],
            [139.90177394130632, 35.6170718697025],
            [139.90177394130632, 35.77501909535009],
            [139.64114960199845, 35.77501909535009],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {
      color: 0x355161,
      height: 55,
      extruded_height: 1,
      clamp_to_ground: false,
      use_ground_normals: true,
      wireframe: false,
      reflectivity: 0.5,
      receive_shadow: true,
      outline_show: false,
    },
  });

  // Create controls panel
  const pane = new Pane({ title: "SSR Water Reflection Example" });

  // Camera controls
  addCameraControl(view, pane);

  // Date/Time controls for sun position
  addDateControl(view, pane);

  // SSR controls
  const ssrFolder = pane.addFolder({ title: "SSR Settings" });

  ssrFolder
    .addBinding({ visible: ssrLayer.visible }, "visible")
    .on("change", (ev) => {
      ssrLayer.visible = ev.value;
    });

  const ssrParams = {
    resolutionScale: ssrLayer.ref.raw?.resolutionScale,
    iterations: ssrLayer.ref.raw?.iterations,
    binarySearchIterations: ssrLayer.ref.raw?.binarySearchIterations,
    pixelZSize: ssrLayer.ref.raw?.pixelZSize,
    pixelStride: ssrLayer.ref.raw?.pixelStride,
    pixelStrideZCutoff: ssrLayer.ref.raw?.pixelStrideZCutoff,
    maxRayDistance: ssrLayer.ref.raw?.maxRayDistance,
    screenEdgeFadeStart: ssrLayer.ref.raw?.screenEdgeFadeStart,
    eyeFadeStart: ssrLayer.ref.raw?.eyeFadeStart,
    eyeFadeEnd: ssrLayer.ref.raw?.eyeFadeEnd,
    jitter: ssrLayer.ref.raw?.jitter,
    roughness: ssrLayer.ref.raw?.roughness,
  };

  ssrFolder
    .addBinding(ssrParams, "resolutionScale", { min: 0.1, max: 1, step: 0.1 })
    .on("change", (ev) => {
      ssrParams.resolutionScale = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "iterations", { min: 1 })
    .on("change", (ev) => {
      ssrParams.iterations = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "binarySearchIterations", {
      min: 0,
      step: 1,
    })
    .on("change", (ev) => {
      ssrParams.binarySearchIterations = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "pixelZSize", { min: 0 })
    .on("change", (ev) => {
      ssrParams.pixelZSize = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "pixelStride", { min: 0 })
    .on("change", (ev) => {
      ssrParams.pixelStride = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "pixelStrideZCutoff", {
      min: 0,
    })
    .on("change", (ev) => {
      ssrParams.pixelStrideZCutoff = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "maxRayDistance", { min: 0 })
    .on("change", (ev) => {
      ssrParams.maxRayDistance = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "screenEdgeFadeStart", {
      min: 0,
    })
    .on("change", (ev) => {
      ssrParams.screenEdgeFadeStart = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "eyeFadeStart", { min: 0 })
    .on("change", (ev) => {
      ssrParams.eyeFadeStart = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "eyeFadeEnd", { min: 0 })
    .on("change", (ev) => {
      ssrParams.eyeFadeEnd = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "jitter", { min: 0, max: 1 })
    .on("change", (ev) => {
      ssrParams.jitter = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });

  ssrFolder
    .addBinding(ssrParams, "roughness", { min: 0 })
    .on("change", (ev) => {
      ssrParams.roughness = ev.value;
      ssrLayer.update({ ssr: ssrParams });
    });
};
