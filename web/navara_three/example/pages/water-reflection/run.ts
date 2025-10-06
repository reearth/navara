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

  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  // Camera controls
  addCameraControl(view, pane);

  // Date/Time controls for sun position
  addDateControl(view, pane);

  // SSR controls
  addSSRControls(view, pane);

  // Water polygon controls
  addWaterControls(view, pane);
};

const addSSRControls = (view: ThreeView, pane: Pane) => {
  // Add SSR effect layer
  let ssrLayer = view.addLayer<SSREffectLayer>({
    type: "effect",
    ssr: {},
  });

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
        if (v.value) {
          ssrLayer = view.addLayer<SSREffectLayer>({
            type: "effect",
            ssr: ssrParams,
          });
        } else {
          ssrLayer.delete();
        }
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
  const mvtLayerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
    },
    polygon: {
      color: 0x001e0f,
      reflectivity: 0.5,
      clamp_to_ground: true,
      wireframe: false,
      water: true,
      shininess: 100,
      specular_strength: 2,
      apply_water_normal: false,
    },
    vector_tile: {
      max_zoom: 16,
      layers: ["waterarea"],
    },
  };
  const geoJsonLayerDescription: LayerDescription = {
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
      color: 0x001e0f,
      height: 55,
      extruded_height: 1,
      clamp_to_ground: false,
      use_ground_normals: true,
      wireframe: false,
      reflectivity: 0.5,
      roughness: 0.2,
      receive_shadow: true,
      outline_show: false,
      water: true,
      shininess: 100,
      specular_strength: 2,
      apply_water_normal: false,
    },
  };

  let waterLayer = view.addLayer(geoJsonLayerDescription);

  const waterParams = {
    dataType: "geojson",
    reflectivity: mvtLayerDescription.polygon?.reflectivity ?? 0,
    roughness: mvtLayerDescription.polygon?.roughness ?? 0,
    water: mvtLayerDescription.polygon?.water ?? true,
    waterScaleNormal: mvtLayerDescription.polygon?.water_scale_normal ?? 0.1,
    waterSpeed: mvtLayerDescription.polygon?.water_speed ?? 0.0003,
    shininess: mvtLayerDescription.polygon?.shininess ?? 100,
    specularStrength: mvtLayerDescription.polygon?.specular_strength ?? 2,
    applyWaterNormal: mvtLayerDescription.polygon?.apply_water_normal ?? false,
  };

  const fields: FolderFields<typeof waterParams> = [
    {
      name: "dataType",
      params: {
        options: [
          { text: "geojson", value: "geojson" },
          { text: "mvt", value: "mvt" },
        ],
      },
      onChange: (v) => {
        waterParams.dataType = v.value;
        waterLayer.delete();
        switch (v.value) {
          case "mvt": {
            waterLayer = view.addLayer(mvtLayerDescription);
            break;
          }
          case "geojson": {
            waterLayer = view.addLayer(geoJsonLayerDescription);
            break;
          }
        }
      },
    },
    {
      name: "reflectivity",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.reflectivity = v.value;
        mvtLayerDescription.polygon.reflectivity = v.value;
        geoJsonLayerDescription.polygon.reflectivity = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "roughness",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.roughness = v.value;
        mvtLayerDescription.polygon.roughness = v.value;
        geoJsonLayerDescription.polygon.roughness = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "water",
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.water = v.value;
        mvtLayerDescription.polygon.water = v.value;
        geoJsonLayerDescription.polygon.water = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "waterScaleNormal",
      params: { min: 0.01, max: 1.0, step: 0.01 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.waterScaleNormal = v.value;
        mvtLayerDescription.polygon.water_scale_normal = v.value;
        geoJsonLayerDescription.polygon.water_scale_normal = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "waterSpeed",
      params: { min: 0.0, max: 0.01, step: 0.0001 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.waterSpeed = v.value;
        mvtLayerDescription.polygon.water_speed = v.value;
        geoJsonLayerDescription.polygon.water_speed = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "shininess",
      params: { min: 0, max: 200, step: 1 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.shininess = v.value;
        mvtLayerDescription.polygon.shininess = v.value;
        geoJsonLayerDescription.polygon.shininess = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "specularStrength",
      params: { min: 0, max: 10, step: 0.1 },
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.specularStrength = v.value;
        mvtLayerDescription.polygon.specular_strength = v.value;
        geoJsonLayerDescription.polygon.specular_strength = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
    {
      name: "applyWaterNormal",
      onChange: (v) => {
        if (!mvtLayerDescription.polygon || !geoJsonLayerDescription.polygon)
          return;
        waterParams.applyWaterNormal = v.value;
        mvtLayerDescription.polygon.apply_water_normal = v.value;
        geoJsonLayerDescription.polygon.apply_water_normal = v.value;
        waterLayer.update(
          waterParams.dataType === "mvt"
            ? mvtLayerDescription
            : geoJsonLayerDescription,
        );
      },
    },
  ];

  addFieldsToFolder(
    pane.addFolder({ title: "Water Settings" }),
    waterParams,
    fields,
  );
};
