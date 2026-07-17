import ThreeView, { Color, type Layer, type Source } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { CesiumIonPlugin } from "@navaramap/three_plugins";
import { ButtonApi, Pane } from "tweakpane";

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
  initialTerrainType: TerrainType = "reearth",
) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  // The Cesium Ion plugin resolves its asset endpoint during `view.init()`, so
  // it must be registered before init. Register it unconditionally (even when
  // starting on Re:Earth terrain) so the terrain switcher can swap to Cesium Ion
  // later without disposing and recreating the view.
  const cesiumIon = new CesiumIonPlugin({
    assetId: CESIUM_ION_ASSET_ID,
    accessToken: CESIUM_ION_TOKEN,
  });
  view.addPlugin(cesiumIon);

  const attribution = view.attribution;

  await view.init();

  view.globe.color = new Color().setHex(0xcccccc);

  defaultPlugin.addDefaultPhotorealScene();
  view.toneMappingExposure = 10;

  // Current terrain handles. Re:Earth uses an explicit quantized-mesh source;
  // Cesium Ion's `addTerrain` creates an implicit source (reclaimed when its
  // layer is deleted), so only its layer handle is tracked there.
  let currentTerrainType = initialTerrainType;
  let terrainSource: Source | undefined;
  let terrainLayer: Layer | undefined;

  const terrainDataset = (type: TerrainType) =>
    type === "cesiumIon"
      ? TERRAIN_DATASETS.cesiumIon
      : TERRAIN_DATASETS.reearthQuantizedMesh;

  const addTerrain = (type: TerrainType) => {
    if (type === "cesiumIon") {
      terrainLayer = cesiumIon.addTerrain({
        maxZoom: 18,
        castShadow: true,
        receiveShadow: true,
        requestVertexNormals: true,
        requestWaterMask: true,
      });
      terrainSource = undefined;
    } else {
      terrainSource = view.addSource({
        type: "quantized-mesh",
        url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
        maxZoom: 18,
        requestVertexNormals: true,
        requestWaterMask: true,
      });
      terrainLayer = view.addLayer({
        type: "terrain",
        source: terrainSource,
        terrain: { castShadow: true, receiveShadow: true },
      });
    }
    attribution?.add([terrainDataset(type), TILE_DATASETS.eox]);
  };

  // Delete the current terrain layer and its explicit source (if any) on the
  // live view. The globe falls back to the flat ellipsoid.
  const removeTerrain = () => {
    terrainLayer?.delete();
    terrainSource?.delete();
    terrainLayer = undefined;
    terrainSource = undefined;
    // Drop the current terrain's credit (eox stays — permanent base).
    attribution?.remove([terrainDataset(currentTerrainType)]);
  };

  // Switch terrain on the live view: delete the current terrain, then add the
  // new one. No dispose/recreate — the raster layers, camera, and panel persist.
  const setTerrain = (type: TerrainType) => {
    if (type === currentTerrainType && terrainLayer) return;
    removeTerrain();
    currentTerrainType = type;
    addTerrain(type);
  };

  addTerrain(initialTerrainType);

  const eox = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.eox.url,
    maxZoom: 15,
  });
  view.addLayer({ type: "raster", source: eox });

  const photo = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiSeamlessphoto.url,
    maxZoom: 18,
    minZoom: 10,
  });
  view.addLayer({ type: "raster", source: photo });

  view.setCamera(CAMERA_COORDS);

  activePane?.dispose();
  const pane = new Pane();
  activePane = pane;

  // Terrain controls. The type field swaps the terrain live via `setTerrain`
  // (delete + add on the running view); the button deletes/re-adds the terrain
  // layer outright (the globe falls back to the flat ellipsoid) — all without
  // disposing the ThreeView.
  const terrainFolder = pane.addFolder({ title: "Terrain", expanded: true });
  const terrainParams = { terrain: initialTerrainType };
  let deleteButton: ButtonApi | undefined = undefined;
  terrainFolder
    .addBinding(terrainParams, "terrain", {
      label: "type",
      options: TERRAIN_OPTIONS,
    })
    .on("change", (ev) => {
      setTerrain(ev.value as TerrainType);
      if (deleteButton) {
        deleteButton.title = "delete terrain layer";
      }
    });
  deleteButton = terrainFolder.addButton({ title: "delete terrain layer" });
  deleteButton.on("click", () => {
    if (terrainLayer) {
      removeTerrain();
      deleteButton.title = "add terrain layer";
    } else {
      addTerrain(currentTerrainType);
      deleteButton.title = "delete terrain layer";
    }
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
};
