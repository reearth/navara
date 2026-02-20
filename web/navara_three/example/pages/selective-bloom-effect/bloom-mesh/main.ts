import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  degreeToRadian,
  geodeticToVector3,
  type BoxMeshLayer,
  type SphereMeshLayer,
} from "@navara/three";
import { Vector3 } from "three";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView({ debug: true, shadow: true });
  await view.init();

  const atmospheres = view.addDefaultAtmosphereLayers();
  atmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  const date = new Date();
  date.setHours(8);
  view.atmosphere.date = date;

  view.setCamera({
    lng: 139.767125,
    lat: 35.676,
    height: 800,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Selective bloom effect
  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
    },
  });

  view.addDefaultEffectLayers();

  // Mesh layers with bloom
  const tokyoStationPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 200,
  });

  view.addLayer<BoxMeshLayer>({
    type: "mesh",
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
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
    selectiveEffectOcclusion: "normal",
  });

  const spherePosition = tokyoStationPosition
    .clone()
    .add(new Vector3(-500, 0, -600));

  view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 100,
      color: new Color().setHex(0x00aaff),
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
    selectiveEffectOcclusion: "normal",
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
