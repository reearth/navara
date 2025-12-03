import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

const gGeoLayersDef: MaterialLayerDescription[] = [
  {
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.YamanashiKyonaka.url },
    model: {
      show: true,
      pointSize: 0.3,
      height: 0,
      maxSse: 16,
    },
  },
  {
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauKakegawaCastle.url },
    model: {
      show: true,
      pointSize: 0.3,
      height: 0,
      maxSse: 16,
    },
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.setCamera({
    lat: 35.4904441833,
    lng: 138.1674957275,
    height: 34945.88,
    heading: 53.2889709473,
    pitch: -49.3131942749,
    roll: 0.0,
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
