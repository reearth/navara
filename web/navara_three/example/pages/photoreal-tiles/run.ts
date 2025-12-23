import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

const gGeoLayersDef: MaterialLayerDescription[] = [
  {
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.googlePhotorealTiles.url,
    },
    model: {
      maxSse: 60,
    },
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addCtrlPanel(gGeoLayersDef, view, pane);
  addDateControl(view, pane);
  showAttributions([TILES_3D_DATASETS.googlePhotorealTiles]);
};
