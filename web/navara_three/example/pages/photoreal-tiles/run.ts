import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

const gGeoLayersDef: MaterialLayerDescription[] = [
  {
    type: "cesium3dtiles",
    data: {
      url: "https://tile.googleapis.com/v1/3dtiles/root.json?key=your_api_key",
    },
    model: { max_sse: 120 },
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
  showAttributions([TILE_DATASETS.openstreetmap]);
};
