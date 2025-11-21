import type {
  BoxMeshLayer,
  Layer,
  LayerHandle,
  SelectiveBloomEffectLayer,
  SphereMeshLayer,
} from "@navara/three";
import { Pane, type FolderApi } from "tweakpane";

import { TILES_3D_DATASETS } from "../../../helpers/constants";
import type { SelectiveEffects } from "../effects/setupSelectiveEffects";
import type {
  GeoJsonModelLayer,
  SceneLayers,
  DrumModelState,
  SoldierModelState,
  LayerEffectPayload,
} from "../layers/createSceneLayers";

// ============================================
// Helper Functions for Common UI Patterns
// ============================================

type LayerEffectState = {
  effects: string[];
  emissiveColor?: number;
  emissiveIntensity: number;
  selectiveDepthTest: boolean;
};

const buildEffectPayload = (
  state: LayerEffectState,
): LayerEffectPayload => ({
  effect_id: [...state.effects],
  selectiveDepthTest: state.selectiveDepthTest,
  emissive_color: state.emissiveColor,
  emissive_intensity: state.emissiveIntensity,
});

const setEffectEnabled = (
  state: LayerEffectState,
  effectId: string,
  enabled: boolean,
) => {
  const hasEffect = state.effects.includes(effectId);
  if (enabled && !hasEffect) {
    state.effects = [...state.effects, effectId];
  } else if (!enabled && hasEffect) {
    state.effects = state.effects.filter((id) => id !== effectId);
  }
};

/**
 * Add effect toggle controls (Bloom & Outline) to a folder
 */
const addLayerEffectControls = (
  folder: FolderApi,
  params: { bloomEnabled: boolean; outlineEnabled: boolean },
  state: LayerEffectState,
  bloomId: string,
  outlineId: string,
  onChange: () => void,
) => {
  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", (ev) => {
      setEffectEnabled(state, bloomId, ev.value);
      onChange();
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", (ev) => {
      setEffectEnabled(state, outlineId, ev.value);
      onChange();
    });
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
  SelectiveEffects & {
    paneTitle?: string;
  };

export const createPostProcessingPane = ({
  paneTitle = "Selective Bloom Parameters",
  selectiveBloom,
  selectiveOutline,
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

  setupBloomFolder(pane, selectiveBloom);
  setupMeshFolder(pane, {
    title: "Cube (Red)",
    layer: cubeLayer,
    configKey: "box",
    bloomId: selectiveBloom.id,
    outlineId: selectiveOutline.id,
    params: {
      emissiveColor: 0xff0000,
      emissiveIntensity: 1.1,
      visible: true,
      selectiveDepthTest: true,
      bloomEnabled: false,
      outlineEnabled: false,
    },
  });
  setupMeshFolder(pane, {
    title: "Sphere (Blue)",
    layer: sphereLayer,
    configKey: "sphere",
    bloomId: selectiveBloom.id,
    outlineId: selectiveOutline.id,
    params: {
      emissiveColor: 0x0000ff,
      emissiveIntensity: 1.0,
      visible: true,
      selectiveDepthTest: true,
      bloomEnabled: true,
      outlineEnabled: false,
    },
  });
  setupDrumFolder(pane, drumLayer, selectiveBloom.id, selectiveOutline.id);
  setupSoldierFolder(
    pane,
    soldierLayer,
    selectiveBloom.id,
    selectiveOutline.id,
  );
  setupTilesFolder(pane, {
    title: "Chiyoda Buildings",
    layer: chiyodaLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChiyoda.url,
    bloomId: selectiveBloom.id,
    outlineId: selectiveOutline.id,
    params: {
      baseColor: 0xffffff,
      emissiveColor: 0xffffff,
      visible: true,
      selectiveDepthTest: true,
      emissiveIntensity: 0.3,
      bloomEnabled: true,
      outlineEnabled: true,
    },
  });
  setupTilesFolder(pane, {
    title: "Chuo Buildings",
    layer: chuoLayer,
    datasetUrl: TILES_3D_DATASETS.plateauChuo.url,
    bloomId: selectiveBloom.id,
    outlineId: selectiveOutline.id,
    params: {
      baseColor: 0xffffff,
      emissiveColor: 0xffffff,
      visible: true,
      selectiveDepthTest: true,
      emissiveIntensity: 0.3,
      bloomEnabled: false,
      outlineEnabled: false,
    },
  });

  return pane;
};

const setupBloomFolder = (
  pane: Pane,
  selectiveBloom: LayerHandle<SelectiveBloomEffectLayer>,
) => {
  const params = {
    strength: 0.1,
    radius: 0.5,
    threshold: 0.0,
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
      selectiveBloom.ref.onUpdateConfig({
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
      selectiveBloom.ref.onUpdateConfig({
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
      selectiveBloom.ref.onUpdateConfig({
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
      selectiveBloom.ref.onUpdateConfig({
        selectiveBloom: {
          debugMode: ev.value,
        },
      });
    });

  folder.addBinding(params, "debugMask").on("change", (ev) => {
    selectiveBloom.ref.onUpdateConfig({
      debugMask: ev.value,
    });
  });
};

type MeshLayerHandle = LayerHandle<BoxMeshLayer | SphereMeshLayer>;

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
    selectiveDepthTest: boolean;
    bloomEnabled: boolean;
    outlineEnabled: boolean;
  };
};

const setupMeshFolder = (pane: Pane, options: MeshFolderOptions) => {
  const { title, layer, bloomId, outlineId, configKey } = options;
  const params = { ...options.params };
  const effectState: LayerEffectState = {
    effects: [],
    emissiveColor: params.emissiveColor,
    emissiveIntensity: params.emissiveIntensity,
    selectiveDepthTest: params.selectiveDepthTest,
  };

  if (params.bloomEnabled) {
    effectState.effects.push(bloomId);
  }
  if (params.outlineEnabled) {
    effectState.effects.push(outlineId);
  }

  const applyMeshState = () => {
    layer.ref.onUpdateConfig({
      ...buildMeshConfig(configKey, {
        emissive: effectState.emissiveColor,
        emissiveIntensity: effectState.emissiveIntensity,
      }),
      ...buildEffectPayload(effectState),
    });
  };

  const folder = pane.addFolder({ title });

  folder.addBinding(params, "visible").on("change", (ev) => {
    layer.ref.visible = ev.value;
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", (ev) => {
      effectState.selectiveDepthTest = ev.value;
      applyMeshState();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      effectState.emissiveColor = ev.value;
      applyMeshState();
    });

  addLayerEmissiveIntensityControl(
    folder,
    params,
    (value) => {
      effectState.emissiveIntensity = value;
      applyMeshState();
    },
    { min: 0.0, max: 10.0, step: 0.1 },
  );

  addLayerEffectControls(
    folder,
    params,
    effectState,
    bloomId,
    outlineId,
    applyMeshState,
  );

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
    selectiveDepthTest: boolean;
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
  const effectState: LayerEffectState = {
    effects: [],
    emissiveColor: params.emissiveColor,
    emissiveIntensity: params.emissiveIntensity,
    selectiveDepthTest: params.selectiveDepthTest,
  };

  if (params.bloomEnabled) effectState.effects.push(bloomId);
  if (params.outlineEnabled) effectState.effects.push(outlineId);

  const folder = pane.addFolder({ title });

  const updateTilesLayer = () => {
    layer.update({
      type: "cesium3dtiles",
      data: {
        url: datasetUrl,
      },
      model: {
        show: params.visible,
        color: params.baseColor,
        metalness: 0.1,
        roughness: 0.1,
        cast_shadow: true,
        receive_shadow: true,
      },
      ...buildEffectPayload(effectState),
    });
  };

  folder
    .addBinding(params, "baseColor", {
      color: { type: "int" },
      label: "Base Color",
    })
    .on("change", (ev) => {
      params.baseColor = ev.value;
      updateTilesLayer();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      params.emissiveColor = ev.value;
      effectState.emissiveColor = ev.value;
      updateTilesLayer();
    });

  folder.addBinding(params, "visible").on("change", (ev) => {
    params.visible = ev.value;
    updateTilesLayer();
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", (ev) => {
      effectState.selectiveDepthTest = ev.value;
      updateTilesLayer();
    });

  addLayerEmissiveIntensityControl(folder, params, (value) => {
    effectState.emissiveIntensity = value;
    updateTilesLayer();
  });

  addLayerEffectControls(
    folder,
    params,
    effectState,
    bloomId,
    outlineId,
    updateTilesLayer,
  );

  updateTilesLayer();
};

const setupDrumFolder = (
  pane: Pane,
  drumLayer: GeoJsonModelLayer<DrumModelState>,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    visible: true,
    selectiveDepthTest: false,
    baseColor: 0xffffff,
    emissiveColor: 0xffffff,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };
  const effectState: LayerEffectState = {
    effects: [],
    emissiveColor: params.emissiveColor,
    emissiveIntensity: params.emissiveIntensity,
    selectiveDepthTest: params.selectiveDepthTest,
  };

  const folder = pane.addFolder({ title: "Drum Model" });

  const updateDrumModel = () => {
    drumLayer.updateModel({
      show: params.visible,
      color: params.baseColor,
    });
  };
  const applyDrumEffects = () => {
    effectState.selectiveDepthTest = params.selectiveDepthTest;
    drumLayer.updateEffectState(buildEffectPayload(effectState));
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateDrumModel();
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", () => {
      applyDrumEffects();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      params.emissiveColor = ev.value;
      effectState.emissiveColor = ev.value;
      applyDrumEffects();
    });

  addLayerEmissiveIntensityControl(folder, params, (value) => {
    effectState.emissiveIntensity = value;
    applyDrumEffects();
  });
  addLayerEffectControls(
    folder,
    params,
    effectState,
    bloomId,
    outlineId,
    applyDrumEffects,
  );

  updateDrumModel();
  applyDrumEffects();
};

const setupSoldierFolder = (
  pane: Pane,
  soldierLayer: GeoJsonModelLayer<SoldierModelState>,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    visible: true,
    selectiveDepthTest: false,
    animationSpeed: 1.0,
    baseColor: 0xffffff,
    emissiveColor: 0xffffff,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };
  const effectState: LayerEffectState = {
    effects: [],
    emissiveColor: params.emissiveColor,
    emissiveIntensity: params.emissiveIntensity,
    selectiveDepthTest: params.selectiveDepthTest,
  };

  const folder = pane.addFolder({ title: "Soldier Model" });

  const updateSoldierModel = () => {
    soldierLayer.updateModel({
      show: params.visible,
      animation_speed: params.animationSpeed,
      color: params.baseColor,
    });
  };
  const applySoldierEffects = () => {
    effectState.selectiveDepthTest = params.selectiveDepthTest;
    soldierLayer.updateEffectState(buildEffectPayload(effectState));
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateSoldierModel();
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", () => {
      applySoldierEffects();
    });

  folder
    .addBinding(params, "animationSpeed", {
      min: 0.0,
      max: 3.0,
      step: 0.1,
    })
    .on("change", () => {
      updateSoldierModel();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      params.emissiveColor = ev.value;
      effectState.emissiveColor = ev.value;
      applySoldierEffects();
    });

  addLayerEmissiveIntensityControl(folder, params, (value) => {
    effectState.emissiveIntensity = value;
    applySoldierEffects();
  });
  addLayerEffectControls(
    folder,
    params,
    effectState,
    bloomId,
    outlineId,
    applySoldierEffects,
  );

  updateSoldierModel();
  applySoldierEffects();
};
