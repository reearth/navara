import ThreeView, {
  Color,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navara/three";
import type {
  ArclineMeshDesc,
  BoxMeshDesc,
  CylinderMeshDesc,
  GLTFModelDesc,
  InstancedBoxMeshDesc,
  InstancedCylinderMeshDesc,
  InstancedGltfModelMeshDesc,
  InstancedPlaneMeshDesc,
  InstancedSphereMeshDesc,
  BoxChildConfig,
  CylinderChildConfig,
  ModelChildConfig,
  PlaneChildConfig,
  SphereChildConfig,
  PlaneMeshDesc,
  SmoothLineMeshDesc,
  SphereMeshDesc,
  TubeMeshDesc,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Mesh, MeshStandardMaterial } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  LOCAL_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";
import { addDateControl } from "../../../helpers/control";

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultLayers = defaultPlugin.addDefaultPhotorealScene();
  defaultLayers.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(10);

  // Shared origin frame — all meshes are offset from here in NUE coordinates
  const origin = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 0,
  });
  const nueFrame = northUpEastToFixedFrame(origin);

  // Camera looks down at the rows from above
  view.setCamera({
    lng: 139.7182864934,
    lat: 35.6575333591,
    height: 2622.64,
    heading: 63.9397045575,
    pitch: -32.0830169872,
    roll: 0,
  });

  // Base layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 18 },
  });

  // --- Layout constants ---
  // Row 1 (z = -300): Simple mesh layers (Box, Sphere, Cylinder, Plane, Tube, GLTF)
  // Row 2 (z =  300): Instanced Boxes
  // Row 3 (z =  900): Instanced Spheres
  // Row 4 (z = 1500): Instanced Cylinders
  // Row 5 (z = 2100): Instanced Planes
  // Row 6 (z = 2700): Instanced GLTF Models
  // Row 7: Line mesh layers (ArcLine, SmoothLine) — uses geodetic coords directly
  const ROW_Y = 100; // height above ground
  const ROW1_Z = -300;
  const ROW2_Z = 300;
  const ROW3_Z = 900;
  const ROW4_Z = 1500;
  const ROW5_Z = 2100;
  const ROW6_Z = 2700;
  const SPACING = 300; // horizontal spacing between meshes

  // Track all layers for pick handling
  const layers = new Map<number, { name: string; origColor: number }>();

  // Helper to register a simple mesh layer for picking
  const registerLayer = (
    layer: { ref: { batchId?: number } },
    name: string,
    origColor: number,
  ) => {
    const batchId = layer.ref.batchId;
    if (batchId != null) {
      layers.set(batchId, { name, origColor });
    }
  };

  // ============================================================
  // Row 1: Simple pickable mesh layers
  // ============================================================

  // 1. Box
  const boxColor = 0xff4444;
  const boxLayer = view.addMesh<BoxMeshDesc>({
    pickable: true,
    box: {
      width: 100,
      height: 150,
      depth: 100,
      color: new Color().setHex(boxColor),
      castShadow: true,
      receiveShadow: true,
    },
    matrixWorld: nueFrame,
    position: { x: -2.5 * SPACING, y: ROW_Y, z: ROW1_Z },
  });
  registerLayer(boxLayer, "Box", boxColor);

  // 2. Sphere
  const sphereColor = 0x44ff44;
  const sphereLayer = view.addMesh<SphereMeshDesc>({
    pickable: true,
    sphere: {
      radius: 80,
      color: new Color().setHex(sphereColor),
      castShadow: true,
      receiveShadow: true,
    },
    matrixWorld: nueFrame,
    position: { x: -1.5 * SPACING, y: ROW_Y, z: ROW1_Z },
  });
  registerLayer(sphereLayer, "Sphere", sphereColor);

  // 3. Cylinder
  const cylinderColor = 0x4444ff;
  const cylinderLayer = view.addMesh<CylinderMeshDesc>({
    pickable: true,
    cylinder: {
      radiusTop: 50,
      radiusBottom: 50,
      height: 150,
      color: new Color().setHex(cylinderColor),
      castShadow: true,
      receiveShadow: true,
    },
    matrixWorld: nueFrame,
    position: { x: -0.5 * SPACING, y: ROW_Y, z: ROW1_Z },
  });
  registerLayer(cylinderLayer, "Cylinder", cylinderColor);

  // 4. Plane (rotated to face upward so it's visible from above)
  const planeColor = 0xff8800;
  const planeLayer = view.addMesh<PlaneMeshDesc>({
    pickable: true,
    plane: {
      width: 150,
      height: 150,
      color: new Color().setHex(planeColor),
      castShadow: true,
      receiveShadow: true,
    },
    matrixWorld: nueFrame,
    position: { x: 0.5 * SPACING, y: ROW_Y, z: ROW1_Z },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
  });
  registerLayer(planeLayer, "Plane", planeColor);

  // 5. Tube
  const tubeColor = 0xff00ff;
  const tubePoints = [
    { x: -60, y: -60, z: 0 },
    { x: -30, y: 60, z: 30 },
    { x: 30, y: -30, z: -30 },
    { x: 60, y: 60, z: 0 },
  ];
  const tubeLayer = view.addMesh<TubeMeshDesc>({
    pickable: true,
    tube: {
      points: tubePoints,
      radius: 15,
      tubularSegments: 64,
      radialSegments: 12,
      color: new Color().setHex(tubeColor),
      castShadow: true,
      receiveShadow: true,
    },
    matrixWorld: nueFrame,
    position: { x: 1.5 * SPACING, y: ROW_Y, z: ROW1_Z },
  });
  registerLayer(tubeLayer, "Tube", tubeColor);

  // 6. GLTF Model
  // GLTFModelLayer uses RTE rendering and ignores matrixWorld; use position + scale
  const gltfColor = 0x88aaff;
  const gltfPos = geodeticToVector3({
    lat: degreeToRadian(35.673136),
    lng: degreeToRadian(139.76945),
    height: 100,
  });
  const gltfLayer = view.addMesh<GLTFModelDesc>({
    pickable: true,
    gltfModel: {
      url: LOCAL_DATASETS.steelDrumGLTF.url,
      castShadow: true,
      receiveShadow: false,
    },
    position: { x: gltfPos.x, y: gltfPos.y, z: gltfPos.z },
    scale: { x: 50, y: 50, z: 50 },
  });
  // GLTF loads asynchronously; register for picking once loaded
  gltfLayer.ref.on("load", () => {
    const batchId = gltfLayer.ref.batchId;
    if (batchId != null) {
      layers.set(batchId, { name: "GLTF Model", origColor: gltfColor });
    }
  });

  // ============================================================
  // Row 2: Instanced pickable mesh layer
  // ============================================================

  const instanceColors = [0x00ffcc, 0xccff00, 0xff00cc, 0x00ccff, 0xffcc00];
  const children: BoxChildConfig[] = [];
  for (let i = 0; i < 5; i++) {
    children.push({
      width: 60,
      height: 80 + i * 25,
      depth: 60,
      color: new Color().setHex(instanceColors[i]),
      position: {
        x: (i - 2) * SPACING,
        y: (80 + i * 25) / 2,
        z: 0,
      },
    });
  }

  const instancedLayer = view.addMesh<InstancedBoxMeshDesc>({
    pickable: true,
    boxes: {
      castShadow: true,
      receiveShadow: true,
      children,
    },
    matrixWorld: nueFrame,
    position: { x: 0, y: 0, z: ROW2_Z },
  });

  // Register instanced mesh children
  for (let i = 0; i < instancedLayer.ref.batchIds.length; i++) {
    const id = instancedLayer.ref.batchIds[i];
    layers.set(id, {
      name: `Instanced Box #${i}`,
      origColor: instanceColors[i],
    });
  }

  // ============================================================
  // Row 3: Instanced Sphere mesh layer
  // ============================================================

  const sphereInstanceColors = [
    0xff66aa, 0x66ffaa, 0xaa66ff, 0xffaa66, 0x66aaff,
  ];
  const sphereChildren: SphereChildConfig[] = [];
  for (let i = 0; i < 5; i++) {
    sphereChildren.push({
      radius: 40 + i * 10,
      color: new Color().setHex(sphereInstanceColors[i]),
      position: { x: (i - 2) * SPACING, y: 60, z: 0 },
    });
  }
  const instancedSphereLayer = view.addMesh<InstancedSphereMeshDesc>({
    pickable: true,
    spheres: {
      castShadow: true,
      receiveShadow: true,
      children: sphereChildren,
    },
    matrixWorld: nueFrame,
    position: { x: 0, y: 0, z: ROW3_Z },
  });
  for (let i = 0; i < instancedSphereLayer.ref.batchIds.length; i++) {
    layers.set(instancedSphereLayer.ref.batchIds[i], {
      name: `Instanced Sphere #${i}`,
      origColor: sphereInstanceColors[i],
    });
  }

  // ============================================================
  // Row 4: Instanced Cylinder mesh layer
  // ============================================================

  const cylinderInstanceColors = [
    0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6,
  ];
  const cylinderChildren: CylinderChildConfig[] = [];
  for (let i = 0; i < 5; i++) {
    const h = 120 + i * 40;
    cylinderChildren.push({
      radius: 40,
      height: h,
      color: new Color().setHex(cylinderInstanceColors[i]),
      position: { x: (i - 2) * SPACING, y: h / 2, z: 0 },
    });
  }
  const instancedCylinderLayer = view.addMesh<InstancedCylinderMeshDesc>({
    pickable: true,
    cylinders: {
      radiusTop: 1,
      radiusBottom: 1,
      radialSegments: 24,
      castShadow: true,
      receiveShadow: true,
      children: cylinderChildren,
    },
    matrixWorld: nueFrame,
    position: { x: 0, y: 0, z: ROW4_Z },
  });
  for (let i = 0; i < instancedCylinderLayer.ref.batchIds.length; i++) {
    layers.set(instancedCylinderLayer.ref.batchIds[i], {
      name: `Instanced Cylinder #${i}`,
      origColor: cylinderInstanceColors[i],
    });
  }

  // ============================================================
  // Row 5: Instanced Plane mesh layer
  // ============================================================

  const planeInstanceColors = [
    0xff5577, 0x77ff55, 0x5577ff, 0xffee55, 0x55eeff,
  ];
  const planeChildren: PlaneChildConfig[] = [];
  for (let i = 0; i < 5; i++) {
    planeChildren.push({
      width: 150,
      height: 150,
      color: new Color().setHex(planeInstanceColors[i]),
      position: { x: (i - 2) * SPACING, y: 5, z: 0 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    });
  }
  const instancedPlaneLayer = view.addMesh<InstancedPlaneMeshDesc>({
    pickable: true,
    planes: {
      castShadow: false,
      receiveShadow: true,
      children: planeChildren,
    },
    matrixWorld: nueFrame,
    position: { x: 0, y: 0, z: ROW5_Z },
  });
  for (let i = 0; i < instancedPlaneLayer.ref.batchIds.length; i++) {
    layers.set(instancedPlaneLayer.ref.batchIds[i], {
      name: `Instanced Plane #${i}`,
      origColor: planeInstanceColors[i],
    });
  }

  // ============================================================
  // Row 6: Instanced GLTF Model layer
  // ============================================================

  const gltfInstanceColor = 0xcccccc;
  const modelChildren: ModelChildConfig[] = [];
  for (let i = 0; i < 5; i++) {
    modelChildren.push({
      position: { x: (i - 2) * SPACING, y: 0, z: 0 },
      rotation: { x: 0, y: (i * Math.PI) / 5, z: 0 },
      scale: { x: 50, y: 50, z: 50 },
    });
  }
  const instancedGltfLayer = view.addMesh<InstancedGltfModelMeshDesc>({
    pickable: true,
    models: {
      url: LOCAL_DATASETS.steelDrumGLTF.url,
      castShadow: true,
      receiveShadow: false,
      children: modelChildren,
    },
    matrixWorld: nueFrame,
    position: { x: 0, y: 0, z: ROW6_Z },
  });
  instancedGltfLayer.ref.on("load", () => {
    for (let i = 0; i < instancedGltfLayer.ref.batchIds.length; i++) {
      layers.set(instancedGltfLayer.ref.batchIds[i], {
        name: `Instanced GLTF #${i}`,
        origColor: gltfInstanceColor,
      });
    }
  });

  // ============================================================
  // Row 7: Line mesh layers (geodetic coordinates, RTE rendering)
  // ============================================================

  // 7. ArcLine
  const arcLineColor = 0x00ffaa;
  const arcLineLayer = view.addMesh<ArclineMeshDesc>({
    pickable: true,
    arcLines: [
      {
        thickness: 10,
        segments: 64,
        arcHeightScale: 0.1,
        srcColor: new Color().setHex(arcLineColor),
        tgtColor: new Color().setHex(arcLineColor),
        geometry: [
          { lng: 139.78, lat: 35.87 },
          { lng: 139.78, lat: 35.83 },
        ],
      },
    ],
  });
  registerLayer(arcLineLayer, "ArcLine", arcLineColor);

  // 8. SmoothLine
  const smoothLineColor = 0xffaa00;
  const smoothLineLayer = view.addMesh<SmoothLineMeshDesc>({
    pickable: true,
    smoothLines: [
      {
        tension: 0.5,
        closed: false,
        segments: 1,
        lineWidth: 10,
        color: smoothLineColor,
        showPoints: true,
        pointSize: 3,
        pointColor: smoothLineColor,
        points: [
          { lng: 139.74, lat: 35.69, height: 200 },
          { lng: 139.75, lat: 35.68, height: 300 },
          { lng: 139.76, lat: 35.69, height: 250 },
          { lng: 139.77, lat: 35.68, height: 350 },
          { lng: 139.78, lat: 35.69, height: 200 },
        ],
      },
    ],
  });
  registerLayer(smoothLineLayer, "SmoothLine", smoothLineColor);

  // ============================================================
  // Pick event handling
  // ============================================================

  const pane = new Pane({ title: "Mesh Picking" });
  const infoFolder = pane.addFolder({ title: "Picked Info" });

  const info = { name: "(none)", batchId: 0 };
  const nameBinding = infoFolder.addBinding(info, "name", {
    readonly: true,
    label: "name",
  });
  const idBinding = infoFolder.addBinding(info, "batchId", {
    readonly: true,
    label: "batchId",
  });

  let selectedBatchId: number | null = null;

  view.on("pick", (pickInfo) => {
    // Reset previously selected layer color
    if (selectedBatchId != null) {
      const prev = layers.get(selectedBatchId);
      if (prev) {
        updateLayerColor(selectedBatchId, prev.origColor);
      }
    }

    if (pickInfo?.batchId) {
      selectedBatchId = pickInfo.batchId;
      const entry = layers.get(selectedBatchId);

      info.name = entry?.name ?? `Unknown (${selectedBatchId})`;
      info.batchId = selectedBatchId;

      // Highlight selected layer in yellow
      if (entry) {
        updateLayerColor(selectedBatchId, 0xceaaf0);
      }
    } else {
      selectedBatchId = null;
      info.name = "(none)";
      info.batchId = 0;
    }

    nameBinding.refresh();
    idBinding.refresh();
  });

  function updateLayerColor(batchId: number, color: number) {
    const c = new Color().setHex(color);

    if (batchId === boxLayer.ref.batchId) {
      boxLayer.update({ box: { color: c } });
    } else if (batchId === sphereLayer.ref.batchId) {
      sphereLayer.update({ sphere: { color: c } });
    } else if (batchId === cylinderLayer.ref.batchId) {
      cylinderLayer.update({ cylinder: { color: c } });
    } else if (batchId === planeLayer.ref.batchId) {
      planeLayer.update({ plane: { color: c } });
    } else if (batchId === tubeLayer.ref.batchId) {
      tubeLayer.update({ tube: { color: c } });
    } else if (batchId === arcLineLayer.ref.batchId) {
      arcLineLayer.update({
        arcLines: [
          {
            srcColor: c,
            tgtColor: c,
          },
        ],
      });
    } else if (batchId === smoothLineLayer.ref.batchId) {
      smoothLineLayer.update({ smoothLines: [{ color }] });
    } else if (batchId === gltfLayer.ref.batchId) {
      // GLTF: tint via emissive on child MeshStandardMaterials
      gltfLayer.ref.raw?.traverse((child) => {
        if (
          child instanceof Mesh &&
          child.material instanceof MeshStandardMaterial
        ) {
          child.material.emissive.setHex(color);
          child.material.emissiveIntensity = color === gltfColor ? 0 : 0.5;
        }
      });
    } else {
      // Check instanced layers
      let idx = instancedLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedLayer.ref.updateAt(idx, { color: c });
        return;
      }
      idx = instancedSphereLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedSphereLayer.ref.updateAt(idx, { color: c });
        return;
      }
      idx = instancedCylinderLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedCylinderLayer.ref.updateAt(idx, { color: c });
        return;
      }
      idx = instancedPlaneLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedPlaneLayer.ref.updateAt(idx, { color: c });
        return;
      }
      idx = instancedGltfLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedGltfLayer.ref.updateAt(idx, { color: c });
        return;
      }
    }
  }

  addDateControl(view, pane);
  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
