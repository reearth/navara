import type { BoxMeshLayer, Layer, SphereMeshLayer } from "@navara/three";
import { Color, PostEffectOcclusionMode } from "@navara/three";
import { Pane, type FolderApi } from "tweakpane";

import { TILES_3D_DATASETS } from "../../helpers/constants";

import type { PostEffects } from "./run";
import type {
  GeoJsonModelLayer,
  SceneLayers,
  DrumModelState,
  SoldierModelState,
} from "./sceneLayers";

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
      emissiveColor: 0xff0000,
      emissiveIntensity: 1.1,
      visible: true,
      postEffectOcclusion: PostEffectOcclusionMode.Normal,
      bloomEnabled: false,
      outlineEnabled: false,
    },
  });
  setupMeshFolder(pane, {
    title: "Sphere (Blue)",
    layer: sphereLayer,
    configKey: "sphere",
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      emissiveColor: 0x0000ff,
      emissiveIntensity: 1.0,
      visible: true,
      postEffectOcclusion: PostEffectOcclusionMode.Normal,
      bloomEnabled: true,
      outlineEnabled: false,
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
      baseColor: 0xffffff,
      emissiveColor: 0xffffff,
      visible: true,
      postEffectOcclusion: PostEffectOcclusionMode.Normal,
      emissiveIntensity: 0.3,
      bloomEnabled: true,
      outlineEnabled: true,
    },
  });
  setupTilesFolder(pane, {
    title: "Chuo Buildings",
    layer: chuoLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChuo.url,
    bloomId: postEffectBloom.id,
    outlineId: postEffectOutline.id,
    params: {
      baseColor: 0xffffff,
      emissiveColor: 0xffffff,
      visible: true,
      postEffectOcclusion: PostEffectOcclusionMode.Normal,
      emissiveIntensity: 0.3,
      bloomEnabled: false,
      outlineEnabled: false,
    },
  });

  return pane;
};

const setupBloomFolder = (pane: Pane, postEffectBloom: Layer) => {
  // Sync with PostEffectBloomLayer DEFAULT_* values
  const params = {
    strength: 0.8, // Match DEFAULT_STRENGTH
    radius: 0.2, // Match DEFAULT_RADIUS
    threshold: 0.0, // Match DEFAULT_THRESHOLD
    debugMode: 0,
    debugMask: true,
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
        postEffectBloom: {
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
        postEffectBloom: {
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
        postEffectBloom: {
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
        postEffectBloom: {
          debugMode: ev.value,
        },
      });
    });

  folder.addBinding(params, "debugMask").on("change", (ev) => {
    postEffectBloom.update({
      type: "effect",
      debugMask: ev.value,
    });
  });

  // Apply initial parameters to Bloom layer
  postEffectBloom.update({
    type: "effect",
    postEffectBloom: {
      strength: params.strength,
      radius: params.radius,
      threshold: params.threshold,
      debugMode: params.debugMode,
    },
    debugMask: params.debugMask,
  });
};

type MeshLayerHandle = { ref: BoxMeshLayer | SphereMeshLayer };

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
    postEffectOcclusion: number; // 0 = DepthEnabled, 2 = Silhouette
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupMeshFolder = (pane: Pane, options: MeshFolderOptions) => {
  const { title, layer, bloomId, outlineId, configKey } = options;
  const params = { ...options.params };

  // Helper to compute effectIds from current params
  const getEffectIds = (): string[] => {
    const ids: string[] = [];
    if (params.bloomEnabled) ids.push(bloomId);
    if (params.outlineEnabled) ids.push(outlineId);
    return ids;
  };

  const applyMeshState = () => {
    layer.ref.onUpdateConfig({
      ...buildMeshConfig(configKey, {
        emissive: params.emissiveColor,
        emissiveIntensity: params.emissiveIntensity,
      }),
      effectIds: getEffectIds(),
      postEffectOcclusion: params.postEffectOcclusion,
      emissiveColor: params.emissiveColor,
      emissiveIntensity: params.emissiveIntensity,
    });
  };

  const folder = pane.addFolder({ title });

  folder.addBinding(params, "visible").on("change", (ev) => {
    layer.ref.visible = ev.value;
  });

  folder
    .addBinding(params, "postEffectOcclusion", {
      label: "Occlusion Mode",
      options: {
        DepthEnabled: PostEffectOcclusionMode.Normal,
        Silhouette: PostEffectOcclusionMode.Silhouette,
      },
    })
    .on("change", () => {
      applyMeshState();
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
  config: { emissive?: number; emissiveIntensity?: number },
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
    postEffectOcclusion: number; // 0 = DepthEnabled, 2 = Silhouette
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

  // Unified update function using declarative API
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
      options: {
        DepthEnabled: PostEffectOcclusionMode.Normal,
        Silhouette: PostEffectOcclusionMode.Silhouette,
      },
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
    visible: true,
    postEffectOcclusion: PostEffectOcclusionMode.Normal,
    baseColor: 0xffffff,
    emissiveColor: 0xffffff,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Drum Model" });

  // Unified update function using declarative API
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
      options: {
        DepthEnabled: PostEffectOcclusionMode.Normal,
        Silhouette: PostEffectOcclusionMode.Silhouette,
      },
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
    visible: true,
    postEffectOcclusion: PostEffectOcclusionMode.Normal,
    animationSpeed: 1.0,
    baseColor: 0xffffff,
    emissiveColor: 0xffffff,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Soldier Model" });

  // Unified update function using declarative API
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
      options: {
        DepthEnabled: PostEffectOcclusionMode.Normal,
        Silhouette: PostEffectOcclusionMode.Silhouette,
      },
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
