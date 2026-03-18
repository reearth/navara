import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  Color,
  type LayerDescription,
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  LayerHandle,
} from "@navara/three";
import type { GLTFModelLayer } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  LOCAL_DATASETS,
} from "../../../helpers/constants";
import { controlGLTFModel } from "../../../helpers/modelControl";

const SCENES = {
  ToranomonHillsBIM: {
    url: TILES_3D_DATASETS.plateauToranomonHillsBIM.url,
    height: -35,
    startLLE: [35.666944688585495, 139.74895236744666, 38],
  },
  Takanawa: {
    url: TILES_3D_DATASETS.plateauTakanawa.url,
    height: -35,
    startLLE: [35.63517500123948, 139.73968705211848, 45],
  },
};

let gCurSceneName: keyof typeof SCENES = "ToranomonHillsBIM";

export type LayerDescriptions = DefaultLayerDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.atmosphere.date.setHours(8);
  view.toneMappingExposure = 10;

  const defaultLayers = plugin.addDefaultPhotorealLayers();

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
      skirt: false,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: {
      maxZoom: 15,
      minZoom: 6,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
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
      receiveShadow: true,
      castShadow: true,
    },
  });

  const startLLE = SCENES[gCurSceneName].startLLE;

  modelLayer.ref.on("load", () => {
    updateModelLayerPos(view, modelLayer, startLLE);

    controlGLTFModel(view, modelLayer, {
      walkSpeed: 5,
      rotationSpeed: 3,
      cameraFollow: true,
      allowUnderground: true,
      allowFly: true,
    });
  });

  view.lookAt(
    { lat: startLLE[0], lng: startLLE[1], height: startLLE[2] + 1 }, // Add 1 to height to look at model center
    new Vector3(10, 10, 5),
  );

  const pane = new Pane({ title: "Interior Explore" });
  add3DTilesSceneControl(view, pane, modelLayer);

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauToranomonHillsBIM,
    TILES_3D_DATASETS.plateauTakanawa,
  ]);
};

const updateModelLayerPos = (
  view: ThreeView<LayerDescriptions>,
  modelLayer: LayerHandle<GLTFModelLayer>,
  lle: number[],
) => {
  const startPos = geodeticToVector3({
    lat: degreeToRadian(lle[0]),
    lng: degreeToRadian(lle[1]),
    height: lle[2],
  });

  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(lle[0]),
    lng: degreeToRadian(lle[1]),
    height: lle[2],
  });
  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  modelLayer.update({
    position: { x: startPos.x, y: startPos.y, z: startPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  view.cameraFollow(
    true,
    { lat: lle[0], lng: lle[1], height: lle[2] + 1 },
    new Vector3(10, 10, 5),
  );
};

const add3DTilesSceneControl = (
  view: ThreeView<LayerDescriptions>,
  pane: Pane,
  modelLayer: LayerHandle<GLTFModelLayer>,
) => {
  const PARAMS = {
    scene: gCurSceneName,
  };

  // Track current layer
  let currentLayer: ReturnType<typeof view.addLayer> | null = null;

  // Function to load new scene
  const loadScene = (sceneName: keyof typeof SCENES) => {
    // Clear current layer
    if (currentLayer) {
      currentLayer.delete();
    }

    const sceneData = SCENES[sceneName];
    const description: LayerDescription = {
      type: "cesium3dtiles",
      data: {
        url: sceneData.url,
      },
      model: {
        show: true,
        castShadow: true,
        receiveShadow: true,
        height: sceneData.height,
      },
    };
    currentLayer = view.addLayer(description);
  };

  // Load initial scene
  loadScene(PARAMS.scene);

  // Add control to pane
  const folder = pane.addFolder({
    title: "3D Tiles Scene",
    expanded: true,
  });

  folder
    .addBinding(PARAMS, "scene", {
      options: Object.keys(SCENES).reduce(
        (acc, key) => {
          acc[key] = key;
          return acc;
        },
        {} as Record<string, string>,
      ),
    })
    .on("change", (v) => {
      gCurSceneName = v.value as keyof typeof SCENES;
      loadScene(gCurSceneName);

      updateModelLayerPos(view, modelLayer, SCENES[gCurSceneName].startLLE);
    });
};
