import ThreeView, {
  Color,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navara/three";
import type {
  ArclineMeshLayer,
  BoxMeshLayer,
  CylinderMeshLayer,
  GLTFModelLayer,
  InstancedBoxMeshLayer,
  BoxChildConfig,
  PlaneMeshLayer,
  SmoothLineMeshLayer,
  SphereMeshLayer,
  TubeMeshLayer,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
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
  const view = new ThreeView<DefaultDeclarations>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultLayers = defaultPlugin.addDefaultPhotorealLayers();
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
  // Row 2 (z =  300): Instanced mesh layer
  // Row 3: Line mesh layers (ArcLine, SmoothLine) — uses geodetic coords directly
  const ROW_Y = 100; // height above ground
  const ROW1_Z = -300;
  const ROW2_Z = 300;
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
  const boxLayer = view.addMesh<BoxMeshLayer>({
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
  const sphereLayer = view.addMesh<SphereMeshLayer>({
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
  const cylinderLayer = view.addMesh<CylinderMeshLayer>({
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
  const planeLayer = view.addMesh<PlaneMeshLayer>({
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
  const tubeLayer = view.addMesh<TubeMeshLayer>({
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
  const gltfLayer = view.addMesh<GLTFModelLayer>({
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

  const instancedLayer = view.addMesh<InstancedBoxMeshLayer>({
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
  // Row 3: Line mesh layers (geodetic coordinates, RTE rendering)
  // ============================================================

  // 7. ArcLine
  const arcLineColor = 0x00ffaa;
  const arcLineLayer = view.addMesh<ArclineMeshLayer>({
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
  const smoothLineLayer = view.addMesh<SmoothLineMeshLayer>({
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
      // Check instanced layer
      const idx = instancedLayer.ref.batchIds.indexOf(batchId);
      if (idx >= 0) {
        instancedLayer.ref.updateAt(idx, { color: c });
      }
    }
  }

  addDateControl(view, pane);
  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
