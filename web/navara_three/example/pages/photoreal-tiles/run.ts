import ThreeView from "@navara/three";
import type { Layer } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";
import { GOOGLE_MAPS_API_KEY } from "../../helpers/keys";

export const run = async (view: ThreeView) => {
  await view.init();

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  const layer = addTileLayer(view, GOOGLE_MAPS_API_KEY);
  showAttributions([TILES_3D_DATASETS.googlePhotorealTiles], [layer]);
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
