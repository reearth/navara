import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  Color,
  type LayerDescription,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { PersonViewPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  LOCAL_DATASETS,
} from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";

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

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  const startLLE = SCENES[gCurSceneName].startLLE;
  const personView = new PersonViewPlugin({
    character: {
      modelUrl: LOCAL_DATASETS.soldierGLTF.url,
      animation: {
        idleClip: "Idle",
        walkClip: "Walk",
        dashClip: "Run",
        speed: 1.0,
        crossfadeDuration: 0.3,
      },
      modelRotationOffset: { x: Math.PI / 2, y: 0, z: 0 },
      modelScale: 1,
      receiveShadow: true,
    },
    moveSpeed: 5,
    altSpeed: 5,
    rotationSpeed: 4,
    cameraDistance: 10,
    cameraLerpSpeed: 4,
    cameraHeight: 1,
    minAlt: -1000,
    maxAlt: 5000,
    startLat: startLLE[0],
    startLng: startLLE[1],
    startHeight: startLLE[2],
    allowCameraControl: true,
  });
  view.addPlugin(plugin);
  view.addPlugin(personView);
  await view.init();

  view.atmosphere.date = atZoneTime(view.atmosphere.date, 8);
  view.toneMappingExposure = 10;

  const defaultLayers = plugin.addDefaultPhotorealScene();
  defaultLayers.sun.update({ sun: { castShadow: true } });

  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
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
    rasterTile: { maxZoom: 15, minZoom: 6 },
    hillshade: { elevationDecoder: JAPAN_GSI_ELEVATION_DECODER() },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
    },
  });

  personView.start();

  const pane = new Pane({ title: "Interior Explore" });
  add3DTilesSceneControl(view, pane, personView);

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauToranomonHillsBIM,
    TILES_3D_DATASETS.plateauTakanawa,
  ]);
};

const add3DTilesSceneControl = (
  view: ThreeView<CustomDescriptions>,
  pane: Pane,
  personView: PersonViewPlugin,
) => {
  const PARAMS = {
    scene: gCurSceneName,
  };

  let currentLayer: ReturnType<typeof view.addLayer> | null = null;

  const loadScene = (sceneName: keyof typeof SCENES) => {
    if (currentLayer) {
      currentLayer.delete();
    }

    const sceneData = SCENES[sceneName];
    const description: LayerDescription = {
      type: "cesium3dtiles",
      data: { url: sceneData.url },
      model: {
        show: true,
        castShadow: true,
        receiveShadow: true,
        height: sceneData.height,
      },
    };
    currentLayer = view.addLayer(description);
  };

  loadScene(PARAMS.scene);

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

      const lle = SCENES[gCurSceneName].startLLE;
      personView.teleport(lle[1], lle[0], lle[2]);
    });
};
