import ThreeView, {
  Color,
  degreeToRadian,
  northUpEastToFixedFrame,
  geodeticToVector3,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import {
  type InstancedBoxMeshDesc,
  type BoxChildConfig,
  ToneMappingMode,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const RADIUS = 30000; // 30km
const BUILDING_COUNT = 50000;

/** Generate a random point within a circle of the given radius. */
function randomPointInCircle(radius: number): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
}

/** Generate random building configs within a circle. */
function generateBuildings(count: number, radius: number): BoxChildConfig[] {
  const buildings: BoxChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCircle(radius);
    const base = 30 + Math.random() * 60;
    const width = base;
    const depth = base;
    const height = 10 + Math.random() * 200;

    // Taller buildings toward center
    const dist = Math.sqrt(x * x + z * z);
    const centerFactor = 1 - dist / radius;
    const adjustedHeight = height * (1 + centerFactor * 3);

    buildings.push({
      width,
      height: adjustedHeight,
      depth,
      color: new Color().setStyle(
        `hsl(${Math.random() * 360}, ${50 + Math.random() * 50}%, ${30 + Math.random() * 50}%)`,
      ),
      position: { x, y: adjustedHeight / 2, z },
    });
  }
  return buildings;
}

const run = async () => {
  const view = new ThreeView<DefaultDeclarations>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultLayers = defaultPlugin.addDefaultPhotorealScene();

  defaultLayers.toneMapping.update({
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.toneMappingExposure = 2;

  view.addLight({
    ambient: { intensity: 0.5 },
  });

  view.setCamera({
    lng: 139.6021321921,
    lat: 35.613845829,
    height: 9067.93,
    heading: 64.212584702,
    pitch: -36.0220732663,
    roll: 0.2,
  });

  // Base tile layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 18 },
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
      castShadow: true,
      receiveShadow: true,
    },
  });

  // Position the group at Tokyo Station
  const groupPosition = geodeticToVector3({
    lat: degreeToRadian(35.6812),
    lng: degreeToRadian(139.7671),
    height: 0,
  });
  const matrixWorld = northUpEastToFixedFrame(groupPosition);

  // Generate 5000 buildings within 10km radius
  const buildings = generateBuildings(BUILDING_COUNT, RADIUS);

  const boxesLayer = view.addMesh<InstancedBoxMeshDesc>({
    boxes: {
      castShadow: true,
      receiveShadow: true,
      children: buildings,
    },
    matrixWorld,
  });

  // Control panel
  const pane = new Pane({ title: "Instanced Mesh" });
  addDateControl(view, pane);

  const folder = pane.addFolder({ title: "Buildings" });

  folder.addButton({ title: "Add 100 Buildings" }).on("click", () => {
    const newBuildings = generateBuildings(100, RADIUS);
    for (const b of newBuildings) {
      boxesLayer.ref.add(b);
    }
  });

  folder.addButton({ title: "Remove First 100" }).on("click", () => {
    const count = Math.min(100, boxesLayer.ref.count);
    for (let i = 0; i < count; i++) {
      boxesLayer.ref.removeAt(0);
    }
  });

  folder.addButton({ title: "Randomize Colors" }).on("click", () => {
    const count = boxesLayer.ref.count;
    for (let i = 0; i < count; i++) {
      boxesLayer.ref.updateAt(i, {
        color: new Color().setHex(Math.random() * 0xffffff),
      });
    }
  });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
