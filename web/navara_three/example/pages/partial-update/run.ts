import ThreeView, { AmbientLightLayer, Color, Layer } from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gTileLayer: Layer;

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  gTileLayer = view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addPanel(view, pane);
};

function addPanel(view: ThreeView, pane: Pane) {
  const tileFolder = pane.addFolder({ title: "update tile layer" });
  tileFolder.addButton({ title: "update tiles" }).on("click", () => {
    gTileLayer.update({ rasterTile: { color: new Color().setHex(0xff00a0) } });
  });
}
