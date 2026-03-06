import ThreeView, { RainDropEffectLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../helpers/control";

export const run = async (view: ThreeView) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  view.animation = true;

  // Enable default effect chain (tone mapping/AA etc.)
  view.addDefaultEffectLayers();

  defaultPlugin.addDefaultPhotorealLayers();

  const rainDropDefaults = {
    opacity: 0.85,
    dropGridSize: 14,
    dropDensity: 0.8,
    dropLayers: 3,
    dropSizeFactor: 0.017,
    noiseScale: 200,
    refractionStrength: 0.3,
    minDropStrength: 0.01,
    dropFadeStart: 0.3,
    dropFadeEnd: 0.8,
    dropThresholdFactor: 0.08,
    gridDensityLow: 1.15,
    gridDensityHigh: 0.85,
    jitterStrengthLow: 0.45,
    jitterStrengthHigh: 0.08,
  };

  const rainDropLayer = view.addLayer<RainDropEffectLayer>({
    type: "effect",
    rainDrop: { ...rainDropDefaults },
    visible: true,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  const pane = new Pane({
    title: "Rain Drop Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = { ...rainDropDefaults };

  pane
    .addBinding(params, "opacity", { min: 0, max: 1, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { opacity: ev.value } });
    });

  pane
    .addBinding(params, "dropGridSize", { min: 4, max: 24, step: 0.1 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropGridSize: ev.value } });
    });

  pane
    .addBinding(params, "dropDensity", { min: 0, max: 2, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropDensity: ev.value } });
    });

  pane
    .addBinding(params, "dropLayers", { min: 1, max: 6, step: 1 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropLayers: ev.value } });
    });

  pane
    .addBinding(params, "dropSizeFactor", { min: 0.01, max: 0.03, step: 0.001 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropSizeFactor: ev.value } });
    });

  pane
    .addBinding(params, "noiseScale", { min: 50, max: 400, step: 1 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { noiseScale: ev.value } });
    });

  pane
    .addBinding(params, "refractionStrength", { min: 0, max: 1, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({
        rainDrop: { refractionStrength: ev.value },
      });
    });

  const advancedFolder = pane.addFolder({ title: "Advanced", expanded: false });

  advancedFolder
    .addBinding(params, "dropFadeStart", { min: 0, max: 0.9, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropFadeStart: ev.value } });
    });

  advancedFolder
    .addBinding(params, "dropFadeEnd", { min: 0.1, max: 1, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropFadeEnd: ev.value } });
    });

  advancedFolder
    .addBinding(params, "dropThresholdFactor", {
      min: 0.02,
      max: 0.15,
      step: 0.005,
    })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { dropThresholdFactor: ev.value } });
    });

  advancedFolder
    .addBinding(params, "minDropStrength", { min: 0, max: 0.05, step: 0.001 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { minDropStrength: ev.value } });
    });

  advancedFolder
    .addBinding(params, "gridDensityLow", { min: 0.8, max: 1.4, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { gridDensityLow: ev.value } });
    });

  advancedFolder
    .addBinding(params, "gridDensityHigh", { min: 0.6, max: 1.1, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { gridDensityHigh: ev.value } });
    });

  advancedFolder
    .addBinding(params, "jitterStrengthLow", { min: 0.2, max: 0.6, step: 0.01 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { jitterStrengthLow: ev.value } });
    });

  advancedFolder
    .addBinding(params, "jitterStrengthHigh", {
      min: 0.02,
      max: 0.2,
      step: 0.005,
    })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { jitterStrengthHigh: ev.value } });
    });

  pane.addButton({ title: "Reset" }).on("click", () => {
    Object.assign(params, rainDropDefaults);
    pane.refresh();
    rainDropLayer.update({ rainDrop: { ...rainDropDefaults } });
  });

  showAttributions([TILE_DATASETS.gsiSeamlessphoto]);
};
