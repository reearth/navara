import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Pane } from "tweakpane";

import type { SSREffectLayer } from "../../../src/layers/effect";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

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
  const polygonLayer = view.addLayer({
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
      roughness: 0.2,
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
  addSSRControls(ssrLayer, pane);

  // Water polygon controls
  addWaterControls(polygonLayer, pane);
};

const addSSRControls = (
  ssrLayer: ReturnType<typeof ThreeView.prototype.addLayer<SSREffectLayer>>,
  pane: Pane,
) => {
  const ssrParams = {
    visible: ssrLayer.visible,
    resolutionScale: ssrLayer.ref.raw?.resolutionScale ?? 0.5,
    iterations: ssrLayer.ref.raw?.iterations ?? 16,
    binarySearchIterations: ssrLayer.ref.raw?.binarySearchIterations ?? 4,
    pixelZSize: ssrLayer.ref.raw?.pixelZSize ?? 0.1,
    pixelStride: ssrLayer.ref.raw?.pixelStride ?? 16,
    pixelStrideZCutoff: ssrLayer.ref.raw?.pixelStrideZCutoff ?? 10,
    maxRayDistance: ssrLayer.ref.raw?.maxRayDistance ?? 200,
    screenEdgeFadeStart: ssrLayer.ref.raw?.screenEdgeFadeStart ?? 0.9,
    eyeFadeStart: ssrLayer.ref.raw?.eyeFadeStart ?? 0.4,
    eyeFadeEnd: ssrLayer.ref.raw?.eyeFadeEnd ?? 0.8,
    jitter: ssrLayer.ref.raw?.jitter ?? 0,
    roughness: ssrLayer.ref.raw?.roughness ?? 0.1,
    useConeTracing: ssrLayer.ref.raw?.useConeTracing ?? false,
    coneTracingFadeStart: ssrLayer.ref.raw?.coneTracingFadeStart ?? 0,
    coneTracingFadeEnd: ssrLayer.ref.raw?.coneTracingFadeEnd ?? 0,
    coneTracingMaxDistance: ssrLayer.ref.raw?.coneTracingMaxDistance ?? 0,
    coneTracingIteration: ssrLayer.ref.raw?.coneTracingIteration ?? 0,
  };

  const fields: FolderFields<typeof ssrParams> = [
    {
      name: "visible",
      onChange: (v) => {
        ssrLayer.visible = v.value;
      },
    },
    {
      name: "resolutionScale",
      params: { min: 0.1, max: 1, step: 0.1 },
      onChange: (v) => {
        ssrParams.resolutionScale = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "iterations",
      params: { min: 1, step: 1 },
      onChange: (v) => {
        ssrParams.iterations = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "binarySearchIterations",
      params: { min: 0, step: 1 },
      onChange: (v) => {
        ssrParams.binarySearchIterations = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "pixelZSize",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.pixelZSize = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "pixelStride",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.pixelStride = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "pixelStrideZCutoff",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.pixelStrideZCutoff = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "maxRayDistance",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.maxRayDistance = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "screenEdgeFadeStart",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.screenEdgeFadeStart = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "eyeFadeStart",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.eyeFadeStart = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "eyeFadeEnd",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.eyeFadeEnd = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "jitter",
      params: { min: 0, max: 1 },
      onChange: (v) => {
        ssrParams.jitter = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "roughness",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.roughness = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "useConeTracing",
      onChange: (v) => {
        ssrParams.useConeTracing = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "coneTracingFadeStart",
      params: { min: 0, max: 1 },
      onChange: (v) => {
        ssrParams.coneTracingFadeStart = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "coneTracingFadeEnd",
      params: { min: 0, max: 1 },
      onChange: (v) => {
        ssrParams.coneTracingFadeEnd = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "coneTracingMaxDistance",
      params: { min: 0 },
      onChange: (v) => {
        ssrParams.coneTracingMaxDistance = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
    {
      name: "coneTracingIteration",
      params: { min: 0, step: 1 },
      onChange: (v) => {
        ssrParams.coneTracingIteration = v.value;
        ssrLayer.update({ ssr: ssrParams });
      },
    },
  ];

  addFieldsToFolder(
    pane.addFolder({ title: "SSR Settings" }),
    ssrParams,
    fields,
  );
};

const addWaterControls = (
  polygonLayer: ReturnType<typeof ThreeView.prototype.addLayer>,
  pane: Pane,
) => {
  // Store the layer description object
  const layerDescription = {
    type: "geojson" as const,
    data: {
      type: "Feature" as const,
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
        type: "Polygon" as const,
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
      roughness: 0.2,
      receive_shadow: true,
      outline_show: false,
    },
  };

  const waterParams = {
    reflectivity: layerDescription.polygon.reflectivity,
    roughness: layerDescription.polygon.roughness,
  };

  const fields: FolderFields<typeof waterParams> = [
    {
      name: "reflectivity",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        waterParams.reflectivity = v.value;
        layerDescription.polygon.reflectivity = v.value;
        polygonLayer.update(layerDescription);
      },
    },
    {
      name: "roughness",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        waterParams.roughness = v.value;
        layerDescription.polygon.roughness = v.value;
        polygonLayer.update(layerDescription);
      },
    },
  ];

  addFieldsToFolder(
    pane.addFolder({ title: "Water Settings" }),
    waterParams,
    fields,
  );
};
