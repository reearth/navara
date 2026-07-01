import ThreeView, { Color } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AttributionPlugin, CesiumIonPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import {
  datasetToHtmlSource,
  datasetToSource,
} from "../../../helpers/attribution-source";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { addDateControl, atZoneDate } from "../../../helpers/control";

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

const CAMERA_COORDS = {
  lng: 138.20666767536997,
  lat: 34.932278489375214,
  height: 11248.139126100761,
  heading: 64.9520725765606,
  pitch: -8.264746227532386,
  roll: 359.9992800601617,
};

export const run = async (
  view: ThreeView<CustomDescriptions>,
  terrainType: TerrainType,
  onTerrainChange: (next: TerrainType) => void,
) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  let cesiumIon: CesiumIonPlugin | undefined;
  if (terrainType === "cesiumIon") {
    cesiumIon = new CesiumIonPlugin({
      assetId: CESIUM_ION_ASSET_ID,
      accessToken: CESIUM_ION_TOKEN,
    });
    view.addPlugin(cesiumIon);
  }

  await view.init();

  view.globe.color = new Color().setHex(0xcccccc);

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

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.eox.url,
    },
    rasterTile: {
      maxZoom: 15,
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.gsiSeamlessphoto.url,
    },
    rasterTile: {
      maxZoom: 18,
      minZoom: 10,
    },
  });

  view.setCamera(CAMERA_COORDS);

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

  addDateControl(
    view,
    pane,
    atZoneDate(view.atmosphere.date, {
      month: 7,
      date: 1,
      hours: 6,
      minutes: 0,
    }),
  );

  const terrainDataset =
    terrainType === "cesiumIon"
      ? TERRAIN_DATASETS.cesiumIon
      : TERRAIN_DATASETS.reearthQuantizedMesh;
  attribution.show([
    datasetToSource(terrainDataset),
    datasetToHtmlSource(TILE_DATASETS.eox),
  ]);
};
