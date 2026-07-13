import ThreeView, { type Layer } from "@navara/three";
import { AttributionPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../helpers/keys";

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
  // Attribution derived from the shared dataset (constants); per-tile credits
  // nest under it via `creditLayerId`.
  attribution.add([
    {
      ...TILES_3D_DATASETS.googlePhotorealTiles,
      creditLayerId: layer.id,
    },
  ]);
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
