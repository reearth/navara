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
} from "../layers/createSceneLayers";

// ============================================
// Helper Functions for Common UI Patterns
// ============================================

/**
 * Add effect toggle controls (Bloom & Outline) to a folder for Layer
 */
const addLayerEffectControls = (
  folder: FolderApi,
  layer: Layer,
  bloomId: string,
  outlineId: string,
  params: { bloomEnabled: boolean; outlineEnabled: boolean },
) => {
  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", (ev) => {
      layer.toggleEffect(bloomId, ev.value);
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", (ev) => {
      layer.toggleEffect(outlineId, ev.value);
    });
};

/**
 * Add emissive intensity control to a folder for Layer
 */
const addLayerEmissiveIntensityControl = (
  folder: FolderApi,
  layer: Layer,
  params: { emissiveIntensity: number },
) => {
  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Emissive Intensity",
    })
    .on("change", () => {
      layer.setEmissiveIntensity(params.emissiveIntensity);
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

  const folder = pane.addFolder({ title });

  folder.addBinding(params, "visible").on("change", (ev) => {
    layer.ref.visible = ev.value;
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", (ev) => {
      layer.setSelectiveDepthTest(ev.value);
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      layer.ref.onUpdateConfig(
        buildMeshConfig(configKey, {
          emissive: ev.value,
        }),
      );
    });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 10.0,
      step: 0.1,
    })
    .on("change", (ev) => {
      layer.ref.onUpdateConfig(
        buildMeshConfig(configKey, {
          emissiveIntensity: ev.value,
        }),
      );
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", (ev) => {
      layer.ref.toggleEffect(bloomId, ev.value);
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", (ev) => {
      layer.ref.toggleEffect(outlineId, ev.value);
    });

  // Initialize emissive
  layer.ref.onUpdateConfig(
    buildMeshConfig(configKey, {
      emissive: params.emissiveColor,
      emissiveIntensity: params.emissiveIntensity,
    }),
  );

  // Mesh-specific default effects
  if (params.bloomEnabled) {
    layer.ref.enableEffect(bloomId);
  }
  if (params.outlineEnabled) {
    layer.ref.enableEffect(outlineId);
  }
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

  const folder = pane.addFolder({ title });

  const updateTileModel = ({
    show = params.visible,
    color = params.baseColor,
  }: {
    show?: boolean;
    color?: number;
  } = {}) => {
    layer.update({
      type: "cesium3dtiles",
      data: {
        url: datasetUrl,
      },
      model: {
        show,
        color,
        metalness: 0.1,
        roughness: 0.1,
        cast_shadow: true,
        receive_shadow: true,
      },
    });
  };

  folder
    .addBinding(params, "baseColor", {
      color: { type: "int" },
      label: "Base Color",
    })
    .on("change", (ev) => {
      params.baseColor = ev.value;
      updateTileModel({ color: ev.value });
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      params.emissiveColor = ev.value;
      layer.setEmissiveColor(ev.value);
    });

  folder.addBinding(params, "visible").on("change", (ev) => {
    params.visible = ev.value;
    updateTileModel({ show: ev.value, color: params.baseColor });
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", (ev) => {
      layer.setSelectiveDepthTest?.(ev.value);
    });

  addLayerEmissiveIntensityControl(folder, layer, params);

  folder
    .addBinding(params, "bloomEnabled", { label: "Bloom" })
    .on("change", (ev) => {
      layer.toggleEffect(bloomId, ev.value);
      if (ev.value) {
        layer.setEmissiveColor(params.emissiveColor);
      }
    });

  folder
    .addBinding(params, "outlineEnabled", { label: "Outline" })
    .on("change", (ev) => {
      layer.toggleEffect(outlineId, ev.value);
      if (ev.value) {
        layer.setEmissiveColor(params.emissiveColor);
      }
    });

  if (params.bloomEnabled) layer.enableEffect(bloomId);
  if (params.outlineEnabled) layer.enableEffect(outlineId);
  layer.setEmissiveColor(params.emissiveColor);
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

  const folder = pane.addFolder({ title: "Drum Model" });

  const updateDrumModel = () => {
    drumLayer.setSelectiveDepthTest(params.selectiveDepthTest);
    drumLayer.updateModel({
      show: params.visible,
      color: params.baseColor,
    });
  };
  const applyDrumEmissiveColor = (color: number | undefined) => {
    drumLayer.layer.setEmissiveColor(color);
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateDrumModel();
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", () => {
      updateDrumModel();
    });

  folder
    .addBinding(params, "emissiveColor", {
      color: { type: "int" },
      label: "Emissive Color",
    })
    .on("change", (ev) => {
      applyDrumEmissiveColor(ev.value);
    });

  addLayerEmissiveIntensityControl(folder, drumLayer.layer, params);
  addLayerEffectControls(folder, drumLayer.layer, bloomId, outlineId, params);

  // Initialize emissive color to match params
  applyDrumEmissiveColor(params.emissiveColor);
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

  const folder = pane.addFolder({ title: "Soldier Model" });

  const updateSoldierModel = () => {
    soldierLayer.setSelectiveDepthTest(params.selectiveDepthTest);
    soldierLayer.updateModel({
      show: params.visible,
      animation_speed: params.animationSpeed,
      color: params.baseColor,
    });
  };
  const applySoldierEmissiveColor = (color: number | undefined) => {
    soldierLayer.layer.setEmissiveColor(color);
  };

  folder.addBinding(params, "visible").on("change", () => {
    updateSoldierModel();
  });

  folder
    .addBinding(params, "selectiveDepthTest", {
      label: "Selective Depth Test",
    })
    .on("change", () => {
      updateSoldierModel();
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
      applySoldierEmissiveColor(ev.value);
    });

  addLayerEmissiveIntensityControl(folder, soldierLayer.layer, params);
  addLayerEffectControls(
    folder,
    soldierLayer.layer,
    bloomId,
    outlineId,
    params,
  );

  applySoldierEmissiveColor(params.emissiveColor);
};
