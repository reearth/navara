import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";
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

  // Create controls panel
  const pane = new Pane({ title: "SSR Water Reflection Example" });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  // Camera controls
  addCameraControl(view, pane);

  // Date/Time controls for sun position
  addDateControl(view, pane);

  // SSR controls
  addSSRControls(ssrLayer, pane);

  // Water polygon controls
  addWaterControls(view, pane);
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
    useConeTracing: ssrLayer.ref.raw?.useConeTracing ?? false,
    coneTracingFadeStart: ssrLayer.ref.raw?.coneTracingFadeStart ?? 0,
    coneTracingFadeEnd: ssrLayer.ref.raw?.coneTracingFadeEnd ?? 0,
    coneTracingMaxDistance: ssrLayer.ref.raw?.coneTracingMaxDistance ?? 0,
    coneTracingIteration: ssrLayer.ref.raw?.coneTracingIteration ?? 0,
    coneTracingIor: ssrLayer.ref.raw?.coneTracingIor ?? 0,
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
    {
      name: "coneTracingIor",
      params: {
        color: {
          alpha: false,
          type: "int",
        },
      },
      onChange: (v) => {
        ssrParams.coneTracingIor = v.value;
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

const addWaterControls = (view: ThreeView, pane: Pane) => {
  // Store the layer description object
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
    },
    polygon: {
      color: 0xcef7ff,
      reflectivity: 0.5,
      clamp_to_ground: true,
      wireframe: false,
    },
    vector_tile: {
      max_zoom: 16,
      layers: ["waterarea"],
    },
  };

  const waterLayer = view.addLayer(layerDescription);

  const waterParams = {
    reflectivity: layerDescription.polygon?.reflectivity ?? 0,
    roughness: layerDescription.polygon?.roughness ?? 0,
  };

  const fields: FolderFields<typeof waterParams> = [
    {
      name: "reflectivity",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        if (!layerDescription.polygon) return;
        waterParams.reflectivity = v.value;
        layerDescription.polygon.reflectivity = v.value;
        waterLayer.update(layerDescription);
      },
    },
    {
      name: "roughness",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        if (!layerDescription.polygon) return;
        waterParams.roughness = v.value;
        layerDescription.polygon.roughness = v.value;
        waterLayer.update(layerDescription);
      },
    },
  ];

  addFieldsToFolder(
    pane.addFolder({ title: "Water Settings" }),
    waterParams,
    fields,
  );
};
