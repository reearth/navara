import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  degreeToRadian,
  geodeticToVector3,
} from "@navara/three";
import type {
  BoxMeshDesc,
  SphereMeshDesc,
  CylinderMeshDesc,
  PlaneMeshDesc,
  TubeMeshDesc,
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

  // Selective outline effect
  const outlineEffect = view.addEffect({
    selectiveOutline: {
      color: new Color().setHex(0x00ff00),
      thickness: 2.0,
      edgeStrength: 1.0,
    },
  });

  // Mesh layers with outline
  const tokyoStationPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 200,
  });

  view.addMesh<BoxMeshDesc>({
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
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

  view.addMesh<SphereMeshDesc>({
    sphere: {
      radius: 100,
      color: new Color().setHex(0x00aaff),
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
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

  view.addMesh<CylinderMeshDesc>({
    cylinder: {
      radiusTop: 50,
      radiusBottom: 80,
      height: 300,
      color: new Color().setHex(0x00ff88),
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
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

  view.addMesh<PlaneMeshDesc>({
    plane: {
      width: 200,
      height: 200,
      color: new Color().setHex(0xffaa00),
      opacity: 1.0,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [outlineEffect.id],
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

  view.addMesh<TubeMeshDesc>({
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
      opacity: 1.0,
      transparent: true,
      effectIds: [outlineEffect.id],
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
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
