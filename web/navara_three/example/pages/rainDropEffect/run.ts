import ThreeView, { RainDropEffectLayer } from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_URLS } from "../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../helpers/control";

export const run = async (view: ThreeView) => {
  await view.init();

  view.animation = true;

  // Enable default effect chain (tone mapping/AA etc.)
  view.addDefaultEffectLayers();

  view.addDefaultAtmosphereLayers();

  const rainDropLayer = view.addLayer<RainDropEffectLayer>({
    type: "effect",
    rainDrop: {
      opacity: 1.0,
      dropGridSize: 12,
      dropDensity: 1,
    },
    visible: true,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const pane = new Pane({
    title: "Rain Drop Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = {
    opacity: 1.0,
    dropGridSize: 12,
    dropDensity: 1,
  };

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
};
