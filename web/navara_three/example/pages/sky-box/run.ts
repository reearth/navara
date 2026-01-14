import ThreeView, {
  Color,
  AmbientLightLayer,
  SkyBoxMeshLayer,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gSkyBoxMeshLayer: LayerHandle<SkyBoxMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  gSkyBoxMeshLayer = view.addLayer<SkyBoxMeshLayer>({
    type: "mesh",
    skyBox: {
    },
  });

  view.addLayer({
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
  if (!gSkyBoxMeshLayer) return;

  const folder = pane.addFolder({ title: "Sky Box Layer" });

}
