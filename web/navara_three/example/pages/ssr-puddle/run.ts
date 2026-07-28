import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  Color,
} from "@navaramap/three";
import { SSREffectDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

import {
  PuddleGeometryEffectDesc,
  type PuddleGeometryConfig,
} from "./puddleGeometry";

export type CustomDescriptions =
  DefaultDescriptions | { effect: PuddleGeometryConfig };

// Puddles on the ground in front of the Marunouchi buildings, so SSR has
// on-screen geometry to reflect when looking at them across the puddles.
const PUDDLE_CENTERS = [
  { lng: 139.7601, lat: 35.679 },
  { lng: 139.7607, lat: 35.6801 },
  { lng: 139.7594, lat: 35.6782 },
];

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  view.toneMappingExposure = 10;

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: {
      castShadow: true,
    },
  });

  const baseImagery = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiSeamlessphoto.url,
    maxZoom: 23,
  });
  view.addLayer({ type: "raster", source: baseImagery });

  const dem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 6,
  });
  view.addLayer({
    type: "terrain",
    source: dem,
    terrain: { receiveShadow: true, castShadow: true },
  });

  const buildings = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.plateauChiyoda.url,
  });
  view.addLayer({
    type: "3d-tiles",
    source: buildings,
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 0.5,
      height: -50,
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.registerEffect("puddleGeometry", PuddleGeometryEffectDesc);

  // The custom pass composites puddles over the scene's MRT normal buffer.
  const puddleLayer = view.addEffect<PuddleGeometryEffectDesc>({
    puddleGeometry: {
      centers: PUDDLE_CENTERS,
      radius: 40,
      wetness: 1,
      roughness: 0.05,
    },
  });

  // SSR reads the app-supplied geometry buffer instead of the MRT normal buffer.
  const ssrLayer = view.addEffect<SSREffectDesc>({
    ssr: {
      geometryBuffer: puddleLayer.ref.texture,
    },
  });

  // Look east across the puddles toward the Marunouchi high-rises.
  view.setCamera({
    lng: 139.7566,
    lat: 35.6776,
    height: 160,
    heading: 55,
    pitch: -22,
    roll: 0,
  });

  const pane = new Pane({ title: "SSR Puddle Example" });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  const params = {
    customBuffer: true,
    radius: 40,
    wetness: 1,
    roughness: 0.05,
  };

  // Swapping the texture object requires an update call; `null` resets SSR to
  // the engine's MRT normal buffer.
  pane
    .addBinding(params, "customBuffer", { label: "Puddle buffer" })
    .on("change", (ev) => {
      ssrLayer.update({
        ssr: {
          geometryBuffer: ev.value ? (puddleLayer.ref.texture ?? null) : null,
        },
      });
    });

  pane
    .addBinding(params, "radius", { min: 5, max: 150, step: 1 })
    .on("change", (ev) => {
      puddleLayer.update({ puddleGeometry: { radius: ev.value } });
    });

  pane
    .addBinding(params, "wetness", { min: 0, max: 1, step: 0.01 })
    .on("change", (ev) => {
      puddleLayer.update({ puddleGeometry: { wetness: ev.value } });
    });

  pane
    .addBinding(params, "roughness", { min: 0, max: 0.5, step: 0.01 })
    .on("change", (ev) => {
      puddleLayer.update({ puddleGeometry: { roughness: ev.value } });
    });

  addCameraControl(view, pane);
  // Fixed UTC instant (noon JST) so the lighting is machine-independent.
  addDateControl(view, pane, new Date("2026-07-27T03:00:00Z"));

  attribution?.add([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);
};
