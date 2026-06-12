import ThreeView, { type Layer } from "@navara/three";
import { AttributionPlugin, type AttributionItem } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../helpers/keys";

/**
 * Google Photorealistic 3D Tiles attribution: an always-visible logo
 * (bottom-left) plus the per-tile dynamic credits tracked from the layer.
 */
const GOOGLE_ATTRIBUTION: AttributionItem = {
  attribution: TILES_3D_DATASETS.googlePhotorealTiles.attribution ?? "Google",
  url: "https://www.google.com/permissions/geoguidelines/",
  logo: "/credits/GoogleMaps.png",
};

export const run = async (view: ThreeView) => {
  // Plugins must be registered before init().
  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  const layer = addTileLayer(view, GOOGLE_MAPS_API_KEY);
  // Static source + logo; the layer is tracked for dynamic per-tile credits.
  attribution.show([GOOGLE_ATTRIBUTION], [layer]);
  addCameraControl(view, pane);
  addDateControl(view, pane);
};

const addTileLayer = (view: ThreeView, token: string): Layer => {
  return view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(token)}`,
    },
    model: {
      maxSse: 60,
    },
  });
};
