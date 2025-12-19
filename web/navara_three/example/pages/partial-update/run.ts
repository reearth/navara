import ThreeView, {
  Color,
  AmbientLightLayer,
  GlowGlobeMeshLayer,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gGlowGlobeMeshLayer: LayerHandle<GlowGlobeMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  glowRadiusScale: 1.2,
  glowCoefficient: 0.5,
  glowExponent: 5.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
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

//   const folder = pane.addFolder({ title: "Glow Globe Layer" });

 
}
