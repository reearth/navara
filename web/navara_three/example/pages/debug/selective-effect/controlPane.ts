import ThreeView, {
  Color,
  type BoxMeshLayer,
  type BoxMeshLayerUpdate,
  type CylinderMeshLayer,
  type CylinderMeshLayerUpdate,
  type Layer,
  type PlaneMeshLayer,
  type PlaneMeshLayerUpdate,
  type SphereMeshLayer,
  type SphereMeshLayerUpdate,
  type TubeMeshLayer,
  type TubeMeshLayerUpdate,
  type SelectiveEffectOcclusion,
} from "@navara/three";
import { Pane, type FolderApi } from "tweakpane";

import { TILES_3D_DATASETS } from "../../../helpers/constants";

import { BLOOM_CONFIG, type PostEffects } from "./run";
import type {
  CameraPosition,
  GeoJsonPolygonLayer,
  SceneLayers,
} from "./sceneLayers";
import {
  CAMERA_FOCUS_POSITIONS,
  CUBE_CONFIG,
  SPHERE_CONFIG,
  CYLINDER_CONFIG,
  TUBE_CONFIG,
  PLANE_CONFIG,
  CHIYODA_CONFIG,
  CHUO_CONFIG,
  POLYGON_CONFIG,
} from "./sceneLayers";

// ============================================
// Constants
// ============================================

/**
 * Occlusion mode options for Tweakpane dropdown
 */
const OCCLUSION_MODE_OPTIONS: Record<string, SelectiveEffectOcclusion> = {
  DepthEnabled: "normal",
  Silhouette: "silhouette",
};

// ============================================
// Helper Functions for Common UI Patterns
// ============================================

/**
 * Helper to compute effectIds from bloom/outline enabled flags
 */
const getEffectIds = (
  bloomEnabled: boolean,
  outlineEnabled: boolean,
  bloomId: string,
  outlineId: string,
): string[] => {
  const ids: string[] = [];
  if (bloomEnabled) ids.push(bloomId);
  if (outlineEnabled) ids.push(outlineId);
  return ids;
};

/**
 * Add emissive intensity control to a folder for Layer
 */
const addLayerEmissiveIntensityControl = (
  folder: FolderApi,
  params: { emissiveIntensity: number },
  onChange: (value: number) => void,
  sliderOptions?: { min?: number; max?: number; step?: number; label?: string },
) => {
  const {
    min = 0.0,
    max = 1.0,
    step = 0.01,
    label = "Emissive Intensity",
  } = sliderOptions ?? {};
  folder
    .addBinding(params, "emissiveIntensity", {
      min,
      max,
      step,
      label,
    })
    .on("change", (ev) => {
      onChange(ev.value);
    });
};

type PaneDependencies = SceneLayers &
  PostEffects & {
    view: ThreeView;
    paneTitle?: string;
  };

export const createControlPane = ({
  view,
  paneTitle = "Selective Effect Parameters",
  postEffectBloom,
  postEffectOutline,
  cubeLayer,
  sphereLayer,
  cylinderLayer,
  tubeLayer,
  planeLayer,
  polygonLayer,
  chiyodaLayer,
  chuoLayer,
}: PaneDependencies): Pane => {
  const pane = new Pane({
    title: paneTitle,
    expanded: true,
  });
  pane.element.style.position = "absolute";
  pane.element.style.width = "340px";
  pane.element.style.right = "0px";
  pane.element.style.maxHeight = "90vh";
  pane.element.style.overflowY = "auto";

  setupBloomFolder(pane, postEffectBloom);

  // Mesh Layer category
  const meshLayerFolder = pane.addFolder({ title: "Mesh Layer" });
  setupMeshFolder(meshLayerFolder, {
    title: "Cube (Red)",
    layer: cubeLayer,
    configKey: "box",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    view,
    focusPosition: CAMERA_FOCUS_POSITIONS.cube,
    params: {
      ...CUBE_CONFIG,
      emissiveColor: CUBE_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });
  setupMeshFolder(meshLayerFolder, {
    title: "Sphere (Blue)",
    layer: sphereLayer,
    configKey: "sphere",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    view,
    focusPosition: CAMERA_FOCUS_POSITIONS.sphere,
    params: {
      ...SPHERE_CONFIG,
      emissiveColor: SPHERE_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });
  setupMeshFolder(meshLayerFolder, {
    title: "Cylinder (Green - Shinjuku)",
    layer: cylinderLayer,
    configKey: "cylinder",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    view,
    focusPosition: CAMERA_FOCUS_POSITIONS.cylinder,
    params: {
      ...CYLINDER_CONFIG,
      emissiveColor: CYLINDER_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });
  setupMeshFolder(meshLayerFolder, {
    title: "Tube (Yellow - Shibuya)",
    layer: tubeLayer,
    configKey: "tube",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    view,
    focusPosition: CAMERA_FOCUS_POSITIONS.tube,
    params: {
      ...TUBE_CONFIG,
      emissiveColor: TUBE_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });
  setupMeshFolder(meshLayerFolder, {
    title: "Plane (Magenta - Akihabara)",
    layer: planeLayer,
    configKey: "plane",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    view,
    focusPosition: CAMERA_FOCUS_POSITIONS.plane,
    params: {
      ...PLANE_CONFIG,
      emissiveColor: PLANE_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });

  // GeoJson category
  const geoJsonFolder = pane.addFolder({ title: "GeoJson" });
  setupPolygonFolder(
    geoJsonFolder,
    polygonLayer,
    postEffectBloom.id,
    postEffectOutline.id,
    view,
    CAMERA_FOCUS_POSITIONS.polygon,
  );

  // 3D Tiles category
  const tiles3DFolder = pane.addFolder({ title: "3D Tiles" });
  setupTilesFolder(tiles3DFolder, {
    title: "Chiyoda Buildings",
    layer: chiyodaLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChiyoda.url,
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...CHIYODA_CONFIG,
      emissiveColor: CHIYODA_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });
  setupTilesFolder(tiles3DFolder, {
    title: "Chuo Buildings",
    layer: chuoLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChuo.url,
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...CHUO_CONFIG,
      emissiveColor: CHUO_CONFIG.emissiveColor.toHex(),
      visible: true,
    },
  });

  return pane;
};

const setupBloomFolder = (pane: Pane, postEffectBloom: Layer) => {
  const params = {
    strength: BLOOM_CONFIG.strength,
    radius: BLOOM_CONFIG.radius,
    threshold: BLOOM_CONFIG.threshold,
    debugMode: BLOOM_CONFIG.debugMode,
    debugViews: BLOOM_CONFIG.debugViews,
  };

  const folder = pane.addFolder({ title: "Bloom Settings" });

  folder
    .addBinding(params, "strength", {
      min: 0.0,
      max: 5.0,
      step: 0.01,
    })
    .on("change", (ev) => {
      postEffectBloom.update({
        type: "effect",
        selectiveBloom: {
          strength: ev.value,
        },
      });
    });

  folder
    .addBinding(params, "radius", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
    })
    .on("change", (ev) => {
      postEffectBloom.update({
        type: "effect",
        selectiveBloom: {
          radius: ev.value,
        },
      });
    });

  folder
    .addBinding(params, "threshold", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
    })
    .on("change", (ev) => {
      postEffectBloom.update({
        type: "effect",
        selectiveBloom: {
          threshold: ev.value,
        },
      });
    });

  folder
    .addBinding(params, "debugMode", {
      options: {
        Normal: 0,
        "Base Only": 1,
        "Bloom Only": 2,
        "Bloom Enhanced (×100)": 3,
      },
    })
    .on("change", (ev) => {
      postEffectBloom.update({
        type: "effect",
        selectiveBloom: {
          debugMode: ev.value,
        },
      });
    });

  folder.addBinding(params, "debugViews").on("change", (ev) => {
    postEffectBloom.update({
      type: "effect",
      selectiveBloom: {
        debugViews: ev.value,
      },
    });
  });
};

type MeshLayerHandle = {
  ref:
    | BoxMeshLayer
    | SphereMeshLayer
    | CylinderMeshLayer
    | TubeMeshLayer
    | PlaneMeshLayer;
  update: (
    updates:
      | BoxMeshLayerUpdate
      | SphereMeshLayerUpdate
      | CylinderMeshLayerUpdate
      | TubeMeshLayerUpdate
      | PlaneMeshLayerUpdate,
  ) => void;
};

type MeshFolderOptions = {
  title: string;
  layer: MeshLayerHandle;
  configKey: "box" | "sphere" | "cylinder" | "tube" | "plane";
  bloomId: string;
  outlineId: string;
  view: ThreeView;
  focusPosition: CameraPosition;
  // emissiveColor uses number for Tweakpane, converted to Color when updating layer
  params: {
    emissiveColor: number;
    emissiveIntensity: number;
    visible: boolean;
    selectiveEffectOcclusion: SelectiveEffectOcclusion;
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupMeshFolder = (parent: FolderApi, options: MeshFolderOptions) => {
  const { title, layer, configKey, bloomId, outlineId, view, focusPosition } =
    options;
  const params = { ...options.params };

  const applyMeshState = () => {
    layer.update({
      ...buildMeshConfig(configKey, {
        emissiveColor: new Color().setHex(params.emissiveColor),
        emissiveIntensity: params.emissiveIntensity,
        effectIds: getEffectIds(
          params.bloomEnabled,
          params.outlineEnabled,
          bloomId,
          outlineId,
        ),
        selectiveEffectOcclusion: params.selectiveEffectOcclusion,
      }),
    });
  };

  const folder = parent.addFolder({ title });

  folder.addButton({ title: "Focus" }).on("click", () => {
    view.setCamera(focusPosition);
  });

  folder.addBinding(params, "visible").on("change", (ev) => {
    layer.update({ visible: ev.value });
  });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", () => {
      applyMeshState();
    });

  addLayerEmissiveIntensityControl(
    folder,
    params,
    () => {
      applyMeshState();
    },
    { min: 0.0, max: 10.0, step: 0.1 },
  );

  folder
    .addBinding(params, "selectiveEffectOcclusion", {
      label: "Occlusion Mode",
      options: OCCLUSION_MODE_OPTIONS,
    })
    .on("change", () => {
      applyMeshState();
    });

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", () => {
      applyMeshState();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", () => {
      applyMeshState();
    });

  applyMeshState();
};

const buildMeshConfig = (
  configKey: "box" | "sphere" | "cylinder" | "tube" | "plane",
  config: {
    emissiveColor?: Color;
    emissiveIntensity?: number;
    effectIds?: string[];
    selectiveEffectOcclusion?: SelectiveEffectOcclusion;
  },
) => {
  if (configKey === "box") {
    return { box: config };
  }
  if (configKey === "cylinder") {
    return { cylinder: config };
  }
  if (configKey === "tube") {
    return { tube: config };
  }
  if (configKey === "plane") {
    return { plane: config };
  }
  return { sphere: config };
};

type TilesFolderOptions = {
  title: string;
  layer: Layer;
  datasetUrl: string;
  bloomId: string;
  outlineId: string;
  // baseColor and emissiveColor use number for Tweakpane, converted to Color when updating layer
  params: {
    baseColor: number;
    emissiveColor: number;
    visible: boolean;
    selectiveEffectOcclusion: SelectiveEffectOcclusion;
    emissiveIntensity: number;
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupTilesFolder = (parent: FolderApi, options: TilesFolderOptions) => {
  const {
    title,
    layer,
    datasetUrl,
    bloomId,
    outlineId,
    params: initialParams,
  } = options;

  const params = { ...initialParams };

  const folder = parent.addFolder({ title });

  const updateTilesState = () => {
    layer.update({
      type: "cesium3dtiles",
      data: {
        url: datasetUrl,
      },
      model: {
        show: params.visible,
        color: new Color().setHex(params.baseColor),
        metalness: 0.1,
        roughness: 0.1,
        castShadow: true,
        receiveShadow: true,
        effectIds: getEffectIds(
          params.bloomEnabled,
          params.outlineEnabled,
          bloomId,
          outlineId,
        ),
        emissiveColor: new Color().setHex(params.emissiveColor),
        emissiveIntensity: params.emissiveIntensity,
        selectiveEffectOcclusion: params.selectiveEffectOcclusion,
      },
    });
  };

  folder
    .addBinding(params, "baseColor", {
      color: { type: "int" },
      label: "Base Color",
    })
    .on("change", () => {
      updateTilesState();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", () => {
      updateTilesState();
    });

  folder.addBinding(params, "visible").on("change", () => {
    updateTilesState();
  });

  folder
    .addBinding(params, "selectiveEffectOcclusion", {
      label: "Occlusion Mode",
      options: OCCLUSION_MODE_OPTIONS,
    })
    .on("change", () => {
      updateTilesState();
    });

  addLayerEmissiveIntensityControl(folder, params, () => {
    updateTilesState();
  });

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", () => {
      updateTilesState();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", () => {
      updateTilesState();
    });

  // Apply initial state
  updateTilesState();
};

/**
 * Setup Polygon folder (Odaiba)
 */
const setupPolygonFolder = (
  parent: FolderApi,
  polygonLayer: GeoJsonPolygonLayer,
  bloomId: string,
  outlineId: string,
  view: ThreeView,
  focusPosition: CameraPosition,
) => {
  const params = {
    ...POLYGON_CONFIG,
    emissiveColor: POLYGON_CONFIG.emissiveColor.toHex(),
    visible: true,
  };

  const folder = parent.addFolder({ title: "Polygon (Odaiba)" });

  folder.addButton({ title: "Focus" }).on("click", () => {
    view.setCamera(focusPosition);
  });

  const updatePolygonState = () => {
    const effectIds = getEffectIds(
      params.bloomEnabled,
      params.outlineEnabled,
      bloomId,
      outlineId,
    );

    polygonLayer.updatePolygon({
      show: params.visible,
      effectIds,
      emissiveColor: new Color().setHex(params.emissiveColor),
      emissiveIntensity: params.emissiveIntensity,
      selectiveEffectOcclusion: params.selectiveEffectOcclusion,
    });
  };

  folder.addBinding(params, "visible").on("change", () => updatePolygonState());

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", () => {
      updatePolygonState();
    });

  folder
    .addBinding(params, "selectiveEffectOcclusion", {
      label: "Occlusion Mode",
      options: OCCLUSION_MODE_OPTIONS,
    })
    .on("change", () => {
      updatePolygonState();
    });

  addLayerEmissiveIntensityControl(folder, params, () => {
    updatePolygonState();
  });

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", () => {
      updatePolygonState();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", () => {
      updatePolygonState();
    });

  // Apply initial state
  updatePolygonState();
};
