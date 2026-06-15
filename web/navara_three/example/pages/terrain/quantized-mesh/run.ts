import ThreeView from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { CesiumIonPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS } from "../../../helpers/constants";
import { addDateControl, atZoneTime } from "../../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

export type TerrainType = "cesiumIon" | "reearth";

const TERRAIN_OPTIONS: Record<string, TerrainType> = {
  "Re:Earth": "reearth",
  "Cesium Ion": "cesiumIon",
};

// This token isn't secret.
// ref: https://github.com/Project-PLATEAU/plateau-streaming-tutorial/blob/main/terrain/plateau-terrain-streaming.md#2-plateau-terrain%E3%81%AE%E5%88%A9%E7%94%A8%E6%96%B9%E6%B3%95
const CESIUM_ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiODVhMmQ5OS1hOWZjLTQ3YmYtODlmNi1lNWUwY2MwOGUxYTMiLCJpZCI6MTQ5ODk3LCJpYXQiOjE2ODc5MzQ3NDN9.OG0mc3i7ZxGwHQjlMv3TRjiOvKWpzxglxmJRaUIykTY";
const CESIUM_ION_ASSET_ID = 3258112;

let activePane: Pane | undefined;

export const run = async (
  view: ThreeView<CustomDescriptions>,
  terrainType: TerrainType,
  onTerrainChange: (next: TerrainType) => void,
) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  let cesiumIon: CesiumIonPlugin | undefined;
  if (terrainType === "cesiumIon") {
    cesiumIon = new CesiumIonPlugin({
      assetId: CESIUM_ION_ASSET_ID,
      accessToken: CESIUM_ION_TOKEN,
    });
    view.addPlugin(cesiumIon);
  }

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();
  view.toneMappingExposure = 10;

  if (terrainType === "cesiumIon" && cesiumIon) {
    cesiumIon.addTerrain({
      maxZoom: 18,
      castShadow: true,
      receiveShadow: true,
      requestVertexNormals: true,
      requestWaterMask: true,
    });
  } else {
    view.addLayer({
      type: "terrain",
      data: {
        url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
      },
      quantizedMesh: {
        maxZoom: 18,
        castShadow: true,
        receiveShadow: true,
        requestVertexNormals: true,
        requestWaterMask: true,
      },
    });
  }

  view.setCamera({
    lng: 138.7274, // Mount Fuji
    lat: 35.3606,
    height: 0,
    heading: 0,
    pitch: -25,
    roll: 360.0,
    distance: 20000,
  });

  activePane?.dispose();
  const pane = new Pane();
  activePane = pane;

  const terrainParams = { terrain: terrainType };
  pane
    .addBinding(terrainParams, "terrain", {
      label: "Terrain",
      options: TERRAIN_OPTIONS,
    })
    .on("change", (ev) => {
      if (ev.value === terrainType) return;
      onTerrainChange(ev.value as TerrainType);
    });

  addDateControl(view, pane, atZoneTime(view.atmosphere.date, 6));

  const terrainDataset =
    terrainType === "cesiumIon"
      ? TERRAIN_DATASETS.cesiumIon
      : TERRAIN_DATASETS.reearthQuantizedMesh;
  showAttributions([terrainDataset]);
};
