import ThreeView, { RainDropEffectLayer } from "@navara/three";
import { Pane } from "tweakpane";

import { addHidePaneKeyShortcut } from "../../helpers/control";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.animation = true;

  // Enable default effect chain (tone mapping/AA etc.)
  view.addDefaultEffectLayers();

  view.addDefaultAtmosphereLayers();

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {},
  });

  const rainDropLayer = view.addLayer<RainDropEffectLayer>({
    type: "effect",
    rainDrop: {
      opacity: 1.0,
      dropGridSize: 12,
      timeOffset: 12,
    },
    visible: true,
  });

  const pane = new Pane({
    title: "Rain Drop Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = {
    opacity: 1.0,
    dropGridSize: 12,
    timeOffset: 12,
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
    .addBinding(params, "timeOffset", { min: 0, max: 24, step: 0.5 })
    .on("change", (ev) => {
      rainDropLayer.update({ rainDrop: { timeOffset: ev.value } });
    });
};
