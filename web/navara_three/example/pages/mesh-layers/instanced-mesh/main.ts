import ThreeView, {
  Color,
  degreeToRadian,
  northUpEastToFixedFrame,
  geodeticToVector3,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import {
  type InstancedBoxMeshDesc,
  type InstancedSphereMeshDesc,
  type InstancedPlaneMeshDesc,
  type InstancedCylinderMeshDesc,
  type InstancedGltfModelMeshDesc,
  type BoxChildConfig,
  type SphereChildConfig,
  type PlaneChildConfig,
  type CylinderChildConfig,
  type ModelChildConfig,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

// Each mesh type gets its own cluster — centers arranged on a ring around
// the group origin so the types don't mix visually.
const CLUSTER_RING = 12000; // distance from origin to each cluster center
const CLUSTER_RADIUS = 4000; // per-cluster spread
const BUILDING_COUNT = 1000;
const SPHERE_COUNT = 1000;
const PLANE_COUNT = 1000;
const CYLINDER_COUNT = 1000;
const MODEL_COUNT = 200;

type Cluster = { cx: number; cz: number };

function clusterAt(angleDeg: number): Cluster {
  const a = (angleDeg * Math.PI) / 180;
  return { cx: Math.cos(a) * CLUSTER_RING, cz: Math.sin(a) * CLUSTER_RING };
}

const CLUSTERS = {
  boxes: clusterAt(-90),
  spheres: clusterAt(-18),
  planes: clusterAt(54),
  cylinders: clusterAt(126),
  models: clusterAt(198),
};

function randomPointInCluster(
  cluster: Cluster,
  radius: number,
): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return {
    x: cluster.cx + Math.cos(angle) * r,
    z: cluster.cz + Math.sin(angle) * r,
  };
}

function generateBuildings(count: number, cluster: Cluster): BoxChildConfig[] {
  const buildings: BoxChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCluster(cluster, CLUSTER_RADIUS);
    const base = 30 + Math.random() * 60;
    const height = 10 + Math.random() * 200;

    const dx = x - cluster.cx;
    const dz = z - cluster.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const centerFactor = 1 - dist / CLUSTER_RADIUS;
    const adjustedHeight = height * (1 + centerFactor * 3);

    buildings.push({
      width: base,
      height: adjustedHeight,
      depth: base,
      color: new Color().setStyle(
        `hsl(${Math.random() * 360}, ${50 + Math.random() * 50}%, ${30 + Math.random() * 50}%)`,
      ),
      position: { x, y: adjustedHeight / 2, z },
    });
  }
  return buildings;
}

function generateSpheres(count: number, cluster: Cluster): SphereChildConfig[] {
  const out: SphereChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCluster(cluster, CLUSTER_RADIUS);
    out.push({
      radius: 20 + Math.random() * 60,
      position: { x, y: 400 + Math.random() * 600, z },
      color: new Color().setStyle(`hsl(${Math.random() * 360}, 80%, 60%)`),
    });
  }
  return out;
}

function generatePlanes(count: number, cluster: Cluster): PlaneChildConfig[] {
  const out: PlaneChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCluster(cluster, CLUSTER_RADIUS);
    out.push({
      width: 80 + Math.random() * 120,
      height: 80 + Math.random() * 120,
      position: { x, y: 5, z },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      color: new Color().setStyle(
        `hsl(${Math.random() * 360}, ${50 + Math.random() * 50}%, ${30 + Math.random() * 50}%)`,
      ),
    });
  }
  return out;
}

function generateCylinders(
  count: number,
  cluster: Cluster,
): CylinderChildConfig[] {
  const out: CylinderChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCluster(cluster, CLUSTER_RADIUS);
    const h = 50 + Math.random() * 300;
    out.push({
      radius: 3 + Math.random() * 10,
      height: h,
      position: { x, y: h / 2, z },
      color: new Color().setStyle(
        `hsl(${Math.random() * 360}, ${50 + Math.random() * 50}%, ${30 + Math.random() * 50}%)`,
      ),
    });
  }
  return out;
}

function generateModels(count: number, cluster: Cluster): ModelChildConfig[] {
  const out: ModelChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = randomPointInCluster(cluster, CLUSTER_RADIUS);
    const s = 20 + Math.random() * 40;
    out.push({
      position: { x, y: 0, z },
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
      scale: { x: s, y: s, z: s },
    });
  }
  return out;
}

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: false,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  // Render continuously so the GLTF animation keeps advancing while idle.
  view.animation = true;

  const defaultLayers = defaultPlugin.addDefaultPhotorealScene();
  defaultLayers.toneMapping.delete();

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

  const groupPosition = geodeticToVector3({
    lat: degreeToRadian(35.6812),
    lng: degreeToRadian(139.7671),
    height: 0,
  });
  const matrixWorld = northUpEastToFixedFrame(groupPosition);

  const boxesLayer = view.addMesh<InstancedBoxMeshDesc>({
    boxes: {
      castShadow: true,
      receiveShadow: true,
      children: generateBuildings(BUILDING_COUNT, CLUSTERS.boxes),
    },
    matrixWorld,
  });

  const spheresLayer = view.addMesh<InstancedSphereMeshDesc>({
    spheres: {
      widthSegments: 24,
      heightSegments: 16,
      castShadow: true,
      children: generateSpheres(SPHERE_COUNT, CLUSTERS.spheres),
    },
    matrixWorld,
  });

  const planesLayer = view.addMesh<InstancedPlaneMeshDesc>({
    planes: {
      receiveShadow: true,
      children: generatePlanes(PLANE_COUNT, CLUSTERS.planes),
    },
    matrixWorld,
  });

  const cylindersLayer = view.addMesh<InstancedCylinderMeshDesc>({
    cylinders: {
      radiusTop: 1,
      radiusBottom: 1,
      radialSegments: 12,
      castShadow: true,
      children: generateCylinders(CYLINDER_COUNT, CLUSTERS.cylinders),
    },
    matrixWorld,
  });

  const modelsLayer = view.addMesh<InstancedGltfModelMeshDesc>({
    models: {
      url: LOCAL_DATASETS.soldierGLTF.url,
      castShadow: false,
      receiveShadow: false,
      animationActiveClip: "Run",
      animationSpeed: 1,
      animationLoop: true,
      animationAutoPlay: true,
      children: generateModels(MODEL_COUNT, CLUSTERS.models),
    },
    matrixWorld,
  });

  // Control panel
  const pane = new Pane({ title: "Instanced Mesh" });
  addDateControl(view, pane);

  const buildingsFolder = pane.addFolder({ title: "Buildings" });
  buildingsFolder.addButton({ title: "Add 100" }).on("click", () => {
    for (const b of generateBuildings(100, CLUSTERS.boxes))
      boxesLayer.ref.add(b);
  });
  buildingsFolder.addButton({ title: "Remove First 100" }).on("click", () => {
    const count = Math.min(100, boxesLayer.ref.count);
    for (let i = 0; i < count; i++) boxesLayer.ref.removeAt(0);
  });
  buildingsFolder.addButton({ title: "Randomize Colors" }).on("click", () => {
    const count = boxesLayer.ref.count;
    for (let i = 0; i < count; i++) {
      boxesLayer.ref.updateAt(i, {
        color: new Color().setHex(Math.random() * 0xffffff),
      });
    }
  });

  const spheresFolder = pane.addFolder({ title: "Spheres" });
  spheresFolder.addButton({ title: "Add 50" }).on("click", () => {
    for (const s of generateSpheres(50, CLUSTERS.spheres))
      spheresLayer.ref.add(s);
  });
  spheresFolder.addButton({ title: "Remove First 50" }).on("click", () => {
    const count = Math.min(50, spheresLayer.ref.count);
    for (let i = 0; i < count; i++) spheresLayer.ref.removeAt(0);
  });

  const planesFolder = pane.addFolder({ title: "Planes" });
  planesFolder.addButton({ title: "Add 50" }).on("click", () => {
    for (const p of generatePlanes(50, CLUSTERS.planes)) planesLayer.ref.add(p);
  });
  planesFolder.addButton({ title: "Remove First 50" }).on("click", () => {
    const count = Math.min(50, planesLayer.ref.count);
    for (let i = 0; i < count; i++) planesLayer.ref.removeAt(0);
  });

  const cylindersFolder = pane.addFolder({ title: "Cylinders" });
  cylindersFolder.addButton({ title: "Add 50" }).on("click", () => {
    for (const c of generateCylinders(50, CLUSTERS.cylinders))
      cylindersLayer.ref.add(c);
  });
  cylindersFolder.addButton({ title: "Remove First 50" }).on("click", () => {
    const count = Math.min(50, cylindersLayer.ref.count);
    for (let i = 0; i < count; i++) cylindersLayer.ref.removeAt(0);
  });

  const modelsFolder = pane.addFolder({ title: "Models (GLTF)" });
  modelsFolder.addButton({ title: "Add 20" }).on("click", () => {
    for (const m of generateModels(20, CLUSTERS.models)) modelsLayer.ref.add(m);
  });
  modelsFolder.addButton({ title: "Remove First 20" }).on("click", () => {
    const count = Math.min(20, modelsLayer.ref.count);
    for (let i = 0; i < count; i++) modelsLayer.ref.removeAt(0);
  });

  // Animation — Soldier.glb ships with "Idle", "Walk", "Run", "TPose"
  const animState = {
    clip: "Run" as "Idle" | "Walk" | "Run" | "TPose",
    speed: 1,
    loop: true,
  };
  modelsFolder
    .addBinding(animState, "clip", {
      options: { Idle: "Idle", Walk: "Walk", Run: "Run", TPose: "TPose" },
    })
    .on("change", (e) => {
      modelsLayer.update({ models: { animationActiveClip: e.value } });
    });
  modelsFolder
    .addBinding(animState, "speed", { min: 0, max: 3, step: 0.1 })
    .on("change", (e) => {
      modelsLayer.update({ models: { animationSpeed: e.value } });
    });
  modelsFolder.addBinding(animState, "loop").on("change", (e) => {
    modelsLayer.update({ models: { animationLoop: e.value } });
  });
  modelsFolder.addButton({ title: "Stop Animation" }).on("click", () => {
    modelsLayer.ref.stopAnimation();
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    LOCAL_DATASETS.soldierGLTF,
  ]);
};

run();
