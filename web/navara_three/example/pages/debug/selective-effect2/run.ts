import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three";
import type {
  BoxMeshLayer,
  SphereMeshLayer,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
} from "../../../helpers/constants";

export const run = async (view: ThreeView<DefaultLayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  // Camera: Tokyo Station area
  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const defaultAtmosphere = plugin.addDefaultPhotorealLayers();
  defaultAtmosphere.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  const date = new Date();
  date.setHours(8);
  view.atmosphere.date = date;

  // --- Effect Layer definitions ---

  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
      debugViews: true,
      resolutionScale: 1.0,
    },
    selectiveEffectOcclusion: "normal",
  });

  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 2.0,
      edgeStrength: 1.0,
      debugViews: false,
      resolutionScale: 1.0,
    },
    selectiveEffectOcclusion: "normal",
  });

  // --- Mesh Layers (effectIds reference effect layer IDs) ---

  // Cube at Tokyo Station (bloom only)
  const boxPosition = geodeticToVector3({
    lat: degreeToRadian(35.6812),
    lng: degreeToRadian(139.7671),
    height: 200,
  });
  const boxLayer = view.addLayer<BoxMeshLayer>({
    type: "mesh",
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
      emissiveColor: new Color().setHex(0xff0000),
      emissiveIntensity: 1.0,
      effectIds: [bloomEffect.id],
    },
    position: { x: boxPosition.x, y: boxPosition.y, z: boxPosition.z },
  });

  // Sphere near Tokyo Station (bloom + outline)
  const spherePosition = new Vector3(
    boxPosition.x,
    boxPosition.y,
    boxPosition.z,
  ).add(new Vector3(-500, 0, -600));
  const sphereLayer = view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 150,
      color: new Color().setHex(0x0000ff),
      emissiveColor: new Color().setHex(0x0000ff),
      emissiveIntensity: 1.0,
      effectIds: [bloomEffect.id, outlineEffect.id],
    },
    position: { x: spherePosition.x, y: spherePosition.y, z: spherePosition.z },
  });

  // 3D Tiles: Chiyoda (outline only)
  const chiyodaLayer = view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChiyoda.url },
    model: {
      color: new Color().setHex(0xffffff),
      emissiveColor: new Color().setHex(0xffffff),
      emissiveIntensity: 0.0,
      effectIds: [outlineEffect.id],
    },
  });

  // 3D Tiles: Chuo (no effects)
  view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChuo.url },
    model: {
      color: new Color().setHex(0xffffff),
    },
  });

  // Base tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  // Terrain
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
  ]);

  // --- Debug Controls ---
  const emissiveBufferPass = view.mrtPassLayer.ref.raw?.emissiveBufferPass;

  // Enable emissive buffer debug view by default
  emissiveBufferPass?.enableDebugView(true);

  const pane = new Pane({ title: "Selective Effect Debug" });

  const debugParams = {
    emissiveBuffer: true,
  };

  pane
    .addBinding(debugParams, "emissiveBuffer", { label: "Emissive Buffer" })
    .on("change", (ev) => {
      emissiveBufferPass?.enableDebugView(ev.value);
    });

  // --- Mesh Emissive Controls ---
  const boxFolder = pane.addFolder({ title: "Box", expanded: true });
  const boxParams = {
    emissiveColor: "#ff0000",
    emissiveIntensity: 1.0,
  };
  boxFolder
    .addBinding(boxParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      boxLayer.update({
        box: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  boxFolder
    .addBinding(boxParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      boxLayer.update({ box: { emissiveIntensity: ev.value } });
    });

  const sphereFolder = pane.addFolder({ title: "Sphere", expanded: true });
  const sphereParams = {
    emissiveColor: "#0000ff",
    emissiveIntensity: 1.0,
  };
  sphereFolder
    .addBinding(sphereParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      sphereLayer.update({
        sphere: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  sphereFolder
    .addBinding(sphereParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      sphereLayer.update({ sphere: { emissiveIntensity: ev.value } });
    });

  const cesiumFolder = pane.addFolder({
    title: "Cesium3D Chiyoda",
    expanded: true,
  });
  const cesiumParams = {
    emissiveColor: "#ffffff",
    emissiveIntensity: 0.0,
  };
  cesiumFolder
    .addBinding(cesiumParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      view.updateLayerById(chiyodaLayer.id, {
        model: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  cesiumFolder
    .addBinding(cesiumParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      view.updateLayerById(chiyodaLayer.id, {
        model: { emissiveIntensity: ev.value },
      });
    });
};
