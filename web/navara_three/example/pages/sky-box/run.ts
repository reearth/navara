import ThreeView, {
  Color,
  AmbientLightLayer,
  SkyBoxMeshLayer,
  LayerHandle,
  SunLightLayer,
  StarsLayer,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";
import type { at } from "vitest/dist/chunks/reporters.d.BFLkQcL6.js";

let gSkyBoxMeshLayer: LayerHandle<SkyBoxMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  // view.addLayer<AmbientLightLayer>({
  //   type: "light",
  //   ambient: {},
  // });

  // const defaultAtmospheres = view.addDefaultAtmosphereLayers();
  // defaultAtmospheres.sun.update({
  //   sun: {
  //     intensity: 1,
  //     // castShadow: true,
  //   },
  // });

  view.addLayer<SunLightLayer>({
    type: "light",
    sun: {
      intensity: 1.0,
      // castShadow: true,
    },
  });

  view.addLayer<StarsLayer>({
    type: "mesh",
    stars: {},
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
  // view.camera.options.autoAdjustNearFar = false;
};

function addPanel(view: ThreeView, pane: Pane) {
  if (!gSkyBoxMeshLayer) return;

  const folder = pane.addFolder({ title: "Sky Box Layer" });

}
