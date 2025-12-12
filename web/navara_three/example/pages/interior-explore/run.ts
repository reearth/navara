import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  Color,
  type GLTFModelLayer,
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  LLE,
} from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

import { Vector3, Quaternion, Euler } from "three";
import { controlGLTFModel } from "../../helpers/modelControl";

export const run = async (view: ThreeView) => {
  await view.init();

  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = 10;

  view.addDefaultEffectLayers();
  const defaultLayers = view.addDefaultAtmosphereLayers();

  const sunLightLayer = defaultLayers.sun;
  sunLightLayer.update({
    sun: {
      castShadow: true,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauToranomonHillsBIM.url,
      // url: TILES_3D_DATASETS.plateauTakanawa.url,
    },
    model: {
      show: true,
      castShadow: true,
      receiveShadow: true,
      height: -35,
    },
  });

  const startLLE = [35.666944688585495, 139.74895236744666, 38];

  const startPos = geodeticToVector3(
    new LLE(
      degreeToRadian(startLLE[0]),
      degreeToRadian(startLLE[1]),
      startLLE[2],
    ),
  );

  const normal = geodeticSurfaceNormal(
    new LLE(
      degreeToRadian(startLLE[0]),
      degreeToRadian(startLLE[1]),
      startLLE[2],
    ),
  );
  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model at Mount Fuji summit
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: LOCAL_DATASETS.soldierGLTF.url,
      animationEnabled: true,
      animationActiveClip: "Idle",
      animationSpeed: 1.0,
      animationLoop: true,
      animationAutoPlay: true,
      animationCrossfadeDuration: 0.3,
      useRTE: true,
    },
    position: { x: startPos.x, y: startPos.y, z: startPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  modelLayer.ref.on("load", () => {
    controlGLTFModel(view, modelLayer, {
      runSpeed: 10,
      rotationSpeed: 3,
      cameraFollow: true,
      allowUnderground: true,
    });
  });

  view.lookAt(
    new LLE(startLLE[0], startLLE[1], startLLE[2] + 1), // Add 1 to height to look at model center
    new Vector3(10, 10, 5),
  );

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauToranomonHillsBIM,
  ]);
};
