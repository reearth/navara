import type {
  Layer,
  LayerHandle,
  SelectiveBloomEffectLayer,
} from "@navara/three";
import { Pane } from "tweakpane";

import { LOCAL_DATASETS, TILES_3D_DATASETS } from "../../../helpers/constants";
import type { SelectiveEffects } from "../effects/setupSelectiveEffects";
import type { SceneLayers } from "../layers/createSceneLayers";

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
  setupCubeFolder(pane, cubeLayer, selectiveBloom.id, selectiveOutline.id);
  setupSphereFolder(pane, sphereLayer, selectiveBloom.id);
  setupDrumFolder(pane, drumLayer, selectiveBloom.id, selectiveOutline.id);
  setupSoldierFolder(
    pane,
    soldierLayer,
    selectiveBloom.id,
    selectiveOutline.id,
  );
  setupChiyodaFolder(
    pane,
    chiyodaLayer,
    selectiveBloom.id,
    selectiveOutline.id,
  );
  setupChuoFolder(pane, chuoLayer, selectiveBloom.id, selectiveOutline.id);

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

const setupCubeFolder = (
  pane: Pane,
  cubeLayer: LayerHandle<any>,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    emissiveIntensity: 1.0,
    visible: true,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Cube (Red)" });

  folder.addBinding(params, "visible").on("change", (ev) => {
    cubeLayer.ref.visible = ev.value;
  });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 10.0,
      step: 0.1,
    })
    .on("change", (ev) => {
      cubeLayer.ref.onUpdateConfig({
        box: {
          emissiveIntensity: ev.value,
        },
      });
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", (ev) => {
      const effects = [];
      if (params.outlineEnabled) effects.push(outlineId);
      if (ev.value) effects.push(bloomId);
      cubeLayer.ref.onUpdateConfig({ effects });
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", (ev) => {
      const effects = [];
      if (ev.value) effects.push(outlineId);
      if (params.bloomEnabled) effects.push(bloomId);
      cubeLayer.ref.onUpdateConfig({ effects });
    });
};

const setupSphereFolder = (
  pane: Pane,
  sphereLayer: LayerHandle<any>,
  bloomId: string,
) => {
  const params = {
    emissiveIntensity: 1.0,
    visible: true,
    bloomEnabled: false,
  };

  const folder = pane.addFolder({ title: "Sphere (Blue)" });

  folder.addBinding(params, "visible").on("change", (ev) => {
    sphereLayer.ref.visible = ev.value;
  });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 10.0,
      step: 0.1,
    })
    .on("change", (ev) => {
      sphereLayer.ref.onUpdateConfig({
        sphere: {
          emissiveIntensity: ev.value,
        },
      });
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", (ev) => {
      sphereLayer.ref.onUpdateConfig({
        effects: ev.value ? [bloomId] : [],
      });
    });
};

const setupGeoJsonVisibilityBinding =
  (
    layer: Layer,
    coordinates: [number, number],
    url: string,
    extras?: () => Record<string, unknown>,
  ) =>
  (visible: boolean) => {
    layer.update({
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              coordinates,
              type: "Point",
            },
          },
        ],
      },
      model: {
        show: visible,
        size: 100,
        height: 0,
        clamp_to_ground: true,
        url,
        ...(extras ? extras() : {}),
      },
      ignoreDepth: true,
    });
  };

const setupDrumFolder = (
  pane: Pane,
  drumLayer: Layer,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    visible: true,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Drum Model" });

  const updateVisibility = setupGeoJsonVisibilityBinding(
    drumLayer,
    [139.7682, 35.6763],
    LOCAL_DATASETS.steelDrumGLTF.url,
    () => ({ should_rotate_in_default: true }),
  );

  folder.addBinding(params, "visible").on("change", (ev) => {
    updateVisibility(ev.value);
  });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Emissive",
    })
    .on("change", () => {
      drumLayer.setEmissiveIntensity(params.emissiveIntensity);
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", () => {
      drumLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", () => {
      drumLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });
};

const setupSoldierFolder = (
  pane: Pane,
  soldierLayer: Layer,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    visible: true,
    animationSpeed: 1.0,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Soldier Model" });

  const updateVisibility = setupGeoJsonVisibilityBinding(
    soldierLayer,
    [139.7505, 35.677],
    LOCAL_DATASETS.soldierGLTF.url,
    () => ({
      animation_active_clip: "Walk",
      animation_speed: params.animationSpeed,
    }),
  );

  folder.addBinding(params, "visible").on("change", (ev) => {
    updateVisibility(ev.value);
  });

  folder
    .addBinding(params, "animationSpeed", {
      min: 0.0,
      max: 3.0,
      step: 0.1,
    })
    .on("change", (ev) => {
      params.animationSpeed = ev.value;
      soldierLayer.update({
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                coordinates: [139.7505, 35.677],
                type: "Point",
              },
            },
          ],
        },
        model: {
          show: params.visible,
          size: 100,
          height: 0,
          clamp_to_ground: true,
          url: LOCAL_DATASETS.soldierGLTF.url,
          animation_active_clip: "Walk",
          animation_speed: ev.value,
        },
        ignoreDepth: true,
      });
    });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Emissive",
    })
    .on("change", () => {
      soldierLayer.setEmissiveIntensity(params.emissiveIntensity);
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", () => {
      soldierLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", () => {
      soldierLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });
};

const setupChiyodaFolder = (
  pane: Pane,
  chiyodaLayer: Layer,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    color: { r: 255, g: 255, b: 255 },
    visible: true,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Chiyoda Buildings" });

  folder
    .addBinding(params, "color", { color: { type: "float" } })
    .on("change", (ev) => {
      const color = (ev.value.r << 16) | (ev.value.g << 8) | ev.value.b;
      chiyodaLayer.update({
        type: "cesium3dtiles",
        data: {
          url: TILES_3D_DATASETS.plateauChiyoda.url,
        },
        model: {
          show: params.visible,
          color,
          metalness: 0.1,
          roughness: 0.1,
          cast_shadow: true,
          receive_shadow: true,
        },
      });
    });

  folder.addBinding(params, "visible").on("change", (ev) => {
    chiyodaLayer.update({
      type: "cesium3dtiles",
      data: {
        url: TILES_3D_DATASETS.plateauChiyoda.url,
      },
      model: {
        show: ev.value,
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.1,
        cast_shadow: true,
        receive_shadow: true,
      },
    });
  });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Emissive",
    })
    .on("change", () => {
      chiyodaLayer.setEmissiveIntensity(params.emissiveIntensity);
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", () => {
      chiyodaLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", () => {
      chiyodaLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });
};

const setupChuoFolder = (
  pane: Pane,
  chuoLayer: Layer,
  bloomId: string,
  outlineId: string,
) => {
  const params = {
    color: { r: 255, g: 255, b: 255 },
    visible: true,
    emissiveIntensity: 0.3,
    bloomEnabled: false,
    outlineEnabled: false,
  };

  const folder = pane.addFolder({ title: "Chuo Buildings" });

  folder
    .addBinding(params, "color", { color: { type: "float" } })
    .on("change", (ev) => {
      const color = (ev.value.r << 16) | (ev.value.g << 8) | ev.value.b;
      chuoLayer.update({
        type: "cesium3dtiles",
        data: {
          url: TILES_3D_DATASETS.plateauChuo.url,
        },
        model: {
          show: params.visible,
          color,
          metalness: 0.1,
          roughness: 0.1,
          cast_shadow: true,
          receive_shadow: true,
        },
      });
    });

  folder.addBinding(params, "visible").on("change", (ev) => {
    chuoLayer.update({
      type: "cesium3dtiles",
      data: {
        url: TILES_3D_DATASETS.plateauChuo.url,
      },
      model: {
        show: ev.value,
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.1,
        cast_shadow: true,
        receive_shadow: true,
      },
    });
  });

  folder
    .addBinding(params, "emissiveIntensity", {
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Emissive",
    })
    .on("change", () => {
      chuoLayer.setEmissiveIntensity(params.emissiveIntensity);
    });

  folder
    .addBinding(params, "bloomEnabled", {
      label: "Bloom",
    })
    .on("change", () => {
      chuoLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });

  folder
    .addBinding(params, "outlineEnabled", {
      label: "Outline",
    })
    .on("change", () => {
      chuoLayer.setEffects(composeEffects(params, bloomId, outlineId));
    });
};

const composeEffects = (
  params: { bloomEnabled: boolean; outlineEnabled?: boolean },
  bloomId: string,
  outlineId: string,
): string[] => {
  const effects: string[] = [];
  if (params.outlineEnabled) effects.push(outlineId);
  if (params.bloomEnabled) effects.push(bloomId);
  return effects;
};
