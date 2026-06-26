import ThreeView, { JAPAN_GSI_ELEVATION_DECODER, Color } from "@navara/three";
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
import { addDateControl, atZoneDate } from "../../../helpers/control";

// Static 3D Tiles scene to explore.
const TAKANAWA_3D_TILES = {
  url: TILES_3D_DATASETS.plateauTakanawa.url,
  height: -35,
};

// Preset camera positions the user can teleport to.
const TELEPORT_POSITIONS = {
  Entrance: {
    startLat: 35.63440005782102,
    startLng: 139.74129913927604,
    startHeight: 14.88335643262967,
    startHeading: 5.311365999249998,
    cameraPitch: 0.1,
    fpvPitch: 0.03,
    fpvHeightOffset: 1,
    initialView: "tpv",
  },
  Walkway: {
    startLat: 35.63607100486972,
    startLng: 139.73956163843286,
    startHeight: 38.893856291190644,
    startHeading: -3.066214410322792,
    cameraPitch: 0.1,
    fpvPitch: 0.03,
    fpvHeightOffset: 1,
    initialView: "tpv",
  },
  "Upper Floor": {
    startLat: 35.63448151878663,
    startLng: 139.73904163537088,
    startHeight: 145.19462676419946,
    startHeading: 4.244343252460702,
    cameraPitch: Math.PI * 0.05,
    fpvPitch: Math.PI * 0.03,
    fpvHeightOffset: 1.5,
    initialView: "fpv",
  },
} as const;

type TeleportPositionName = keyof typeof TELEPORT_POSITIONS;

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  const initialPosition = TELEPORT_POSITIONS.Entrance;
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
    rotationSpeed: 1,
    cameraDistance: 8,
    cameraLerpSpeed: 10,
    minAlt: -1000,
    maxAlt: 5000,
    startLat: initialPosition.startLat,
    startLng: initialPosition.startLng,
    startHeight: initialPosition.startHeight,
    startHeading: initialPosition.startHeading,
    // allowCameraControl: true,
    fpvHeightOffset: initialPosition.fpvHeightOffset,
    cameraPitch: initialPosition.cameraPitch,
    fpvPitch: initialPosition.fpvPitch,
    initialView: initialPosition.initialView,
  });
  view.addPlugin(plugin);
  view.addPlugin(personView);
  await view.init();

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

  view.addLayer({
    type: "cesium3dtiles",
    data: { url: TAKANAWA_3D_TILES.url },
    model: {
      show: true,
      castShadow: true,
      receiveShadow: true,
      height: TAKANAWA_3D_TILES.height,
    },
  });

  personView.start();

  createControlPanel();

  const pane = new Pane({ title: "Interior Explore" });
  addDateControl(
    view,
    pane,
    atZoneDate(view.atmosphere.date, { month: 1, date: 1, hours: 10 }),
  );
  addTeleportControl(pane, personView);

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.plateauTakanawa,
  ]);
};

const createControlPanel = (): HTMLDivElement => {
  const hud = document.createElement("div");
  hud.style.cssText = `
    position: fixed; bottom: 8px; right: 12px; z-index: 20;
    font: 12px/1.6 system-ui, sans-serif;
    color: #fff; background: rgba(0,0,0,0.6);
    padding: 12px 16px; border-radius: 8px;
  `;
  hud.innerHTML = `
    <strong>Controls</strong><br>
    W/S: Forward / Backward<br>
    A/D: Turn Left / Right<br>
    Arrow Up / Space: Ascend<br>
    Arrow Down / Ctrl: Descend<br>
    Shift: Dash<br>
    V: Toggle FPV / TPV<br>
    Alt: Orbit Camera
  `.trim();
  document.body.appendChild(hud);
  return hud;
};

const addTeleportControl = (pane: Pane, personView: PersonViewPlugin) => {
  const teleportTo = (name: TeleportPositionName) => {
    const position = TELEPORT_POSITIONS[name];
    personView.setViewMode(position.initialView);
    personView.setFpvPitch(position.fpvPitch);
    personView.setFpvHeightOffset(position.fpvHeightOffset);
    personView.teleport({
      lng: position.startLng,
      lat: position.startLat,
      alt: position.startHeight,
      heading: position.startHeading,
      pitch: position.cameraPitch,
    });
  };

  const folder = pane.addFolder({
    title: "Teleport",
    expanded: true,
  });

  for (const name of Object.keys(
    TELEPORT_POSITIONS,
  ) as TeleportPositionName[]) {
    folder.addButton({ title: name }).on("click", () => teleportTo(name));
  }
};
