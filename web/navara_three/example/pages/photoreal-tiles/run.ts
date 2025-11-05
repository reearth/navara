import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

import { addDateControl } from "../../helpers/control";
const gGeoLayersDef: MaterialLayerDescription[] = [
  {
    type: "cesium3dtiles",
    data: {
      url: "https://tile.googleapis.com/v1/3dtiles/root.json?key=AIzaSyD2Jo_QHIP_4aCi3tnl72JNxCM5RRMrOZ8",
    },
    model: {max_sse: 80},
  },
  // {
  //   type: "tiles",
  //   data: { url: TILE_DATASETS.openstreetmap.url },
  //   raster_tile: {
  //     max_zoom: 23,
  //   },
  // }
];

export const run = async (view: ThreeView) => {
  await view.init();

  // view.addDefaultAtmosphereLayers();

//   view.setCamera({
//     lat: 35.4904441833,
//     lng: 138.1674957275,
//     height: 34945.88,
//     heading: 53.2889709473,
//     pitch: -49.3131942749,
//     roll: 0.0,
//   });

  // view.addLayer({
  //   type: "tiles",
  //   data: { url: TILE_DATASETS.openstreetmap.url },
  //   raster_tile: {
  //     max_zoom: 23,
  //   },
  // });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addCtrlPanel(gGeoLayersDef, view, pane);
  addDateControl(view, pane);
  showAttributions([TILE_DATASETS.openstreetmap]);
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
      title: "Yamanashi - Kyonaka view",
    })
    .on("click", () => {
      view.flyTo({
        lat: 35.4904441833,
        lng: 138.1674957275,
        height: 34945.88,
        heading: 53.2889709473,
        pitch: -49.3131942749,
        roll: 0.0,
      });
    });

 
};
