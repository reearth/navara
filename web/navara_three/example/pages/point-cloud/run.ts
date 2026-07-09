import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialDesc } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  defaultPlugin.addDefaultPhotorealScene();

  view.setCamera({
    lat: 35.4904441833,
    lng: 138.1674957275,
    height: 34945.88,
    heading: 53.2889709473,
    pitch: -49.3131942749,
    roll: 0.0,
  });

  const baseImagery = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({ type: "raster", source: baseImagery });

  // Point-cloud 3D Tiles, each as a 3d-tiles source rendered by a 3d-tiles layer.
  const yamanashiSource = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.YamanashiKyonaka.url,
  });
  const kakegawaSource = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.plateauKakegawaCastle.url,
  });
  const geoLayersDef: MaterialDesc[] = [
    {
      type: "3d-tiles",
      source: yamanashiSource.id,
      model: { show: true, pointSize: 0.3, height: 0, maxSse: 16 },
    },
    {
      type: "3d-tiles",
      source: kakegawaSource.id,
      model: { show: true, pointSize: 0.3, height: 0, maxSse: 16 },
    },
  ];

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addCtrlPanel(geoLayersDef, view, pane);
  addDateControl(view, pane);
  attribution.show([TILE_DATASETS.openstreetmap]);
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
