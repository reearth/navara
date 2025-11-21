import ThreeView, { AmbientLightLayer } from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

const gLayer: MaterialLayerDescription[] = [
  {
    type: "mesh",
    glowSphere: {
      radius: 6378137 * 1.25,
      coefficient: 0.5,
      exponent: 2,
      glowColor: { r: 0.549, g: 0.894, b: 1.0, a: 0.5 },
    },
    position: { x: 0, y: 0, z: 0 },
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

  view.setCamera({
    lng: 90,
    lat: 0.1,
    height: 12600000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  addCtrlPanel(gLayer, view, pane);
  addCameraControl(view, pane);
  addDateControl(view, pane);
};

const addCameraControl = (view: ThreeView, pane: Pane) => {
  pane
    .addButton({
      title: "Globe view",
    })
    .on("click", () => {
      view.flyTo({
        lng: 90,
        lat: 0.1,
        height: 12600000,
        heading: 0,
        pitch: -90,
        roll: 0,
      });
    });

  pane
    .addButton({
      title: "Kakegawa castle view",
    })
    .on("click", () => {
      view.flyTo({
        lat: 34.7734947205,
        lng: 138.0163726807,
        height: 424.66,
        heading: 326.62109375,
        pitch: -56.2649879456,
        roll: 360.0,
      });
    });
};
