import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import type { FeatureCollection } from "geojson";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const tokyoPoints: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Tokyo Station" },
      geometry: { type: "Point", coordinates: [139.7671, 35.6812] },
    },
    {
      type: "Feature",
      properties: { name: "Shibuya" },
      geometry: { type: "Point", coordinates: [139.7016, 35.658] },
    },
    {
      type: "Feature",
      properties: { name: "Shinjuku" },
      geometry: { type: "Point", coordinates: [139.7005, 35.6896] },
    },
    {
      type: "Feature",
      properties: { name: "Ikebukuro" },
      geometry: { type: "Point", coordinates: [139.7107, 35.7295] },
    },
    {
      type: "Feature",
      properties: { name: "Ueno" },
      geometry: { type: "Point", coordinates: [139.7745, 35.7141] },
    },
  ],
};

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({
    debug: true,
    shadow: true,
  });
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.767,
    lat: 35.681,
    height: 1000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Effect Layer
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: true,
    selectiveEffectOcclusion: "normal",
    outlineColor: new Color().setHex(0x00ff00),
    outlineThickness: 2.0,
    outlineEdgeStrength: 1.0,
  });

  // Points around Tokyo area with outline
  view.addLayer({
    type: "geojson",
    data: tokyoPoints,
    billboard: {
      effectIds: [outlineEffect.id],
      color: new Color().setHex(0xff0000),
      size: 500,
      height: 50,
      scaleByDistance: true,
      clampToGround: true,
      depthTest: true,
      url: "/example.png",
      transparent: true,
      center: { x: 0.0, y: -0.5 },
    },
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
    },
  });
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: { maxZoom: 18 },
  });

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.gsiSeamlessphoto]);
};

run();
