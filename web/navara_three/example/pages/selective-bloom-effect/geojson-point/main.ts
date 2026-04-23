import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import type { FeatureCollection } from "geojson";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView({ debug: true, shadow: true });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.775,
    lat: 35.621,
    height: 1000,
    heading: 0,
    pitch: -55,
    roll: 0,
  });

  // Selective bloom effect
  const bloomEffect = view.addEffect({
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
    },
  });

  // GeoJSON points with bloom (Odaiba area landmarks)
  const odaibaPoints: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "A" },
        geometry: { type: "Point", coordinates: [139.775, 35.628] },
      },
      {
        type: "Feature",
        properties: { name: "B" },
        geometry: { type: "Point", coordinates: [139.777, 35.63] },
      },
      {
        type: "Feature",
        properties: { name: "C" },
        geometry: { type: "Point", coordinates: [139.773, 35.626] },
      },
    ],
  };

  view.addLayer({
    type: "geojson",
    data: odaibaPoints,
    point: {
      size: 100,
      sizeInMeters: true,
      clampToGround: true,
      color: new Color().setHex(0x0066ff),
      center: { x: 0, y: -0.5 },
      effectIds: [bloomEffect.id],
      emissiveIntensity: 0.5,
    },
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
      minZoom: 5,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
