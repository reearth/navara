import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  degreeToRadian,
  geodeticToVector3,
} from "@navara/three";
import type {
  BoxMeshLayer,
  SphereMeshLayer,
  CylinderMeshLayer,
  PlaneMeshLayer,
  TubeMeshLayer,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView<DefaultDeclarations>({
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
    lng: 139.767125,
    lat: 35.676,
    height: 800,
    heading: 0,
    pitch: -45,
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

  // Mesh layers with bloom
  const tokyoStationPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 200,
  });

  view.addMesh<BoxMeshLayer>({
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
      emissiveColor: new Color().setHex(0xff0000),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [bloomEffect.id],
    },
    position: {
      x: tokyoStationPosition.x,
      y: tokyoStationPosition.y,
      z: tokyoStationPosition.z,
    },
  });

  const spherePosition = tokyoStationPosition
    .clone()
    .add(new Vector3(-500, 0, -600));

  view.addMesh<SphereMeshLayer>({
    sphere: {
      radius: 100,
      color: new Color().setHex(0x00aaff),
      emissiveColor: new Color().setHex(0x0000ff),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [bloomEffect.id],
    },
    position: {
      x: spherePosition.x,
      y: spherePosition.y,
      z: spherePosition.z,
    },
  });

  // Cylinder
  const cylinderPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.773),
    height: 400,
  });

  view.addMesh<CylinderMeshLayer>({
    cylinder: {
      radiusTop: 50,
      radiusBottom: 80,
      height: 300,
      color: new Color().setHex(0x00ff88),
      emissiveColor: new Color().setHex(0x00ff88),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [bloomEffect.id],
    },
    position: {
      x: cylinderPosition.x,
      y: cylinderPosition.y,
      z: cylinderPosition.z,
    },
  });

  // Plane
  const planePosition = geodeticToVector3({
    lat: degreeToRadian(35.678),
    lng: degreeToRadian(139.767125),
    height: 400,
  });

  view.addMesh<PlaneMeshLayer>({
    plane: {
      width: 200,
      height: 200,
      color: new Color().setHex(0xffaa00),
      emissiveColor: new Color().setHex(0xffaa00),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [bloomEffect.id],
    },
    position: {
      x: planePosition.x,
      y: planePosition.y,
      z: planePosition.z,
    },
  });

  // Tube
  const tubeBasePosition = geodeticToVector3({
    lat: degreeToRadian(35.678),
    lng: degreeToRadian(139.773),
    height: 400,
  });

  view.addMesh<TubeMeshLayer>({
    tube: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 200, z: 0 },
        { x: 300, y: 100, z: 0 },
        { x: 400, y: 300, z: 0 },
      ],
      radius: 20,
      tubularSegments: 64,
      radialSegments: 8,
      color: new Color().setHex(0xff00ff),
      emissiveColor: new Color().setHex(0xff00ff),
      emissiveIntensity: 1.0,
      opacity: 1.0,
      transparent: true,
      effectIds: [bloomEffect.id],
    },
    position: {
      x: tubeBasePosition.x,
      y: tubeBasePosition.y,
      z: tubeBasePosition.z,
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
