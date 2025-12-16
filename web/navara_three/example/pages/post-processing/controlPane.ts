import {
  Color,
  type BoxMeshLayer,
  type BoxMeshLayerUpdate,
  type Layer,
  type SphereMeshLayer,
  type SphereMeshLayerUpdate,
  type PostEffectOcclusion,
} from "@navara/three";
import { Pane, type FolderApi } from "tweakpane";

import { TILES_3D_DATASETS } from "../../helpers/constants";

import { BLOOM_CONFIG, type PostEffects } from "./run";
import type {
  GeoJsonModelLayer,
  SceneLayers,
  DrumModelState,
  SoldierModelState,
} from "./sceneLayers";
import {
  CUBE_CONFIG,
  SPHERE_CONFIG,
  DRUM_CONFIG,
  SOLDIER_CONFIG,
  CHIYODA_CONFIG,
  CHUO_CONFIG,
} from "./sceneLayers";

// ============================================
// Constants
// ============================================

/**
 * Occlusion mode options for Tweakpane dropdown
 */
const OCCLUSION_MODE_OPTIONS: Record<string, PostEffectOcclusion> = {
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
    paneTitle?: string;
  };

export const createControlPane = ({
  paneTitle = "PostEffect Bloom Parameters",
  postEffectBloom,
  postEffectOutline,
  cubeLayer,
  sphereLayer,
  drumLayer,
  soldierLayer,
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

  setupBloomFolder(pane, postEffectBloom);
  setupMeshFolder(pane, {
    title: "Cube (Red)",
    layer: cubeLayer,
    configKey: "box",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...CUBE_CONFIG,
      visible: true,
    },
  });
  setupMeshFolder(pane, {
    title: "Sphere (Blue)",
    layer: sphereLayer,
    configKey: "sphere",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...SPHERE_CONFIG,
      visible: true,
    },
  });
  setupDrumFolder(pane, drumLayer, postEffectBloom.id, postEffectOutline.id);
  setupSoldierFolder(
    pane,
    soldierLayer,
    postEffectBloom.id,
    postEffectOutline.id,
  );
  setupTilesFolder(pane, {
    title: "Chiyoda Buildings",
    layer: chiyodaLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChiyoda.url,
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...CHIYODA_CONFIG,
      visible: true,
    },
  });
  setupTilesFolder(pane, {
    title: "Chuo Buildings",
    layer: chuoLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChuo.url,
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      ...CHUO_CONFIG,
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
    debugMask: BLOOM_CONFIG.debugMask,
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
        bloom: {
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
        bloom: {
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
        bloom: {
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
        bloom: {
          debugMode: ev.value,
        },
      });
    });

  folder.addBinding(params, "debugMask").on("change", (ev) => {
    postEffectBloom.update({
      type: "effect",
      bloom: {
        debugMask: ev.value,
      },
    });
  });
};

type MeshLayerHandle = {
  ref: BoxMeshLayer | SphereMeshLayer;
  update: (updates: BoxMeshLayerUpdate | SphereMeshLayerUpdate) => void;
};

type MeshFolderOptions = {
  title: string;
  layer: MeshLayerHandle;
  configKey: "box" | "sphere";
  bloomId: string;
  outlineId: string;
  params: {
    emissiveColor: number;
    emissiveIntensity: number;
    visible: boolean;
    postEffectOcclusion: PostEffectOcclusion;
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupMeshFolder = (pane: Pane, options: MeshFolderOptions) => {
  const { title, layer, configKey, bloomId, outlineId } = options;
  const params = { ...options.params };

  const applyMeshState = () => {
    layer.update({
      ...buildMeshConfig(configKey, {
        emissiveColor: params.emissiveColor,
        emissiveIntensity: params.emissiveIntensity,
        effectIds: getEffectIds(
          params.bloomEnabled,
          params.outlineEnabled,
          bloomId,
          outlineId,
        ),
        postEffectOcclusion: params.postEffectOcclusion,
      }),
    });
  };

  const folder = pane.addFolder({ title });

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
    .addBinding(params, "postEffectOcclusion", {
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
  configKey: "box" | "sphere",
  config: {
    emissiveColor?: number;
    emissiveIntensity?: number;
    effectIds?: string[];
    postEffectOcclusion?: PostEffectOcclusion;
  },
) => {
  if (configKey === "box") {
    return { box: config };
  }
  return { sphere: config };
};

type TilesFolderOptions = {
  title: string;
  layer: Layer;
  datasetUrl: string;
  bloomId: string;
  outlineId: string;
  params: {
    baseColor: number;
    emissiveColor: number;
    visible: boolean;
    postEffectOcclusion: PostEffectOcclusion;
    emissiveIntensity: number;
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupTilesFolder = (pane: Pane, options: TilesFolderOptions) => {
  const {
    title,
    layer,
    datasetUrl,
    bloomId,
    outlineId,
    params: initialParams,
  } = options;

  const params = { ...initialParams };

  const folder = pane.addFolder({ title });

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
        postEffectOcclusion: params.postEffectOcclusion,
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
    .addBinding(params, "postEffectOcclusion", {
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

const setupDrumFolder = (
  pane: Pane,
  drumLayer: GeoJsonModelLayer<DrumModelState>,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    ...DRUM_CONFIG,
    visible: true,
    baseColor: 0xffffff,
  };

  const folder = pane.addFolder({ title: "Drum Model" });

  const updateDrumState = () => {
    drumLayer.updateModel({
      show: params.visible,
      color: params.baseColor,
      effectIds: getEffectIds(
        params.bloomEnabled,
        params.outlineEnabled,
        bloomId,
        outlineId,
      ),
      emissiveColor: params.emissiveColor,
      emissiveIntensity: params.emissiveIntensity,
      postEffectOcclusion: params.postEffectOcclusion,
    } as Partial<DrumModelState>);
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateDrumState();
  });

  folder
    .addBinding(params, "postEffectOcclusion", {
      label: "Occlusion Mode",
      options: OCCLUSION_MODE_OPTIONS,
    })
    .on("change", () => {
      updateDrumState();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", () => {
      updateDrumState();
    });

  addLayerEmissiveIntensityControl(folder, params, () => {
    updateDrumState();
  });

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", () => {
      updateDrumState();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", () => {
      updateDrumState();
    });

  // Apply initial state
  updateDrumState();
};

const setupSoldierFolder = (
  pane: Pane,
  soldierLayer: GeoJsonModelLayer<SoldierModelState>,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    ...SOLDIER_CONFIG,
    visible: true,
    baseColor: 0xffffff,
  };

  const folder = pane.addFolder({ title: "Soldier Model" });

  const updateSoldierState = () => {
    soldierLayer.updateModel({
      show: params.visible,
      animationSpeed: params.animationSpeed,
      color: params.baseColor,
      effectIds: getEffectIds(
        params.bloomEnabled,
        params.outlineEnabled,
        bloomId,
        outlineId,
      ),
      emissiveColor: params.emissiveColor,
      emissiveIntensity: params.emissiveIntensity,
      postEffectOcclusion: params.postEffectOcclusion,
    } as Partial<SoldierModelState>);
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateSoldierState();
  });

  folder
    .addBinding(params, "postEffectOcclusion", {
      label: "Occlusion Mode",
      options: OCCLUSION_MODE_OPTIONS,
    })
    .on("change", () => {
      updateSoldierState();
    });

  folder
    .addBinding(params, "animationSpeed", {
      min: 0.0,
      max: 3.0,
      step: 0.1,
    })
    .on("change", () => {
      updateSoldierState();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", () => {
      updateSoldierState();
    });

  addLayerEmissiveIntensityControl(folder, params, () => {
    updateSoldierState();
  });

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", () => {
      updateSoldierState();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", () => {
      updateSoldierState();
    });

  // Apply initial state
  updateSoldierState();
};
