import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
  type GLTFModelLayer,
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  LLE,
  Color,
} from "@navara/three";
import { Vector3, Quaternion, Euler } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  LOCAL_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import {
  controlGLTFModel,
  type ModelControlParams,
} from "../../helpers/modelControl";

const params: ModelControlParams = {
  walkSpeed: 5,
  rotationSpeed: 2,
  modelScale: 1,
  cameraFollow: true,
  allowFly: false,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.toneMappingExposure = 3;
  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.addLayer({
    type: "effect",
    smaa: {},
  });

  view.addLayer({
    type: "light",
    sun: {
      intensity: 1,
    },
  });
  view.addLayer({
    type: "mesh",
    sky: {},
  });

  view.addLayer({
    type: "light",
    ambient: {
      intensity: 0.1,
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {
      maxZoom: 23,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
      castShadow: true,
      receiveShadow: true,
      height: -50,
    },
  });

  view.camera.options = {
    autoAdjustNearFar: true,
  };

  const pane = new Pane();
  addDateControl(view, pane);

  showAttributions([
    TERRAIN_DATASETS.mapterhorn,
    TILE_DATASETS.openstreetmap,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);

  const startLLE = [35.69127684, 139.75865163, 7];

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
    },
    position: { x: startPos.x, y: startPos.y, z: startPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  modelLayer.ref.on("load", () => {
    controlGLTFModel(view, modelLayer, params);
  });

  view.lookAt(
    new LLE(startLLE[0], startLLE[1], startLLE[2] + 1), // Add 1 to height to look at model center
    new Vector3(10, 10, 5),
  );

  pane.addBinding(params, "walkSpeed", { min: 1, max: 1000 });
  pane.addBinding(params, "rotationSpeed", { min: 0.1, max: 5 });
  pane
    .addBinding(params, "modelScale", { min: 1, max: 100 })
    .on("change", () => {
      modelLayer.update({
        scale: {
          x: params.modelScale ?? 1,
          y: params.modelScale ?? 1,
          z: params.modelScale ?? 1,
        },
      });
    });

  pane.addBinding(params, "cameraFollow").on("change", () => {
    if (!params.cameraFollow) {
      view.cameraFollow(false);
    }
  });

  pane.addBinding(params, "allowFly");
};
