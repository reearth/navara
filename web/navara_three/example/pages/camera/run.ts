import ThreeView from "@navara/three";
import { AxesHelper } from "three";
import { Pane } from "tweakpane";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const run = async (view: ThreeView) => {
  await view.init();

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scene.add(axesHelper);

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addChangeCameraOption(pane, view);
};

const addChangeCameraOption = (pane: Pane, view: ThreeView) => {
  const cameraParams = {
    longitude: 138.73470764482283,
    latitude: 35.3627947204036,
    altitude: 10000,
    heading: 0, // -180 to 180
    pitch: -90, // -180 to 0
  };
  const folder = pane.addFolder({
    title: "Change Camera",
    expanded: true,
  });

  const changeFunc = () => {
    view.setCamera({
      longitude: cameraParams.longitude,
      latitude: cameraParams.latitude,
      altitude: cameraParams.altitude,
      heading: cameraParams.heading,
      pitch: cameraParams.pitch,
    });
  };

  folder
    .addBinding(cameraParams, "longitude", { min: -180.0, max: 180.0 })
    .on("change", changeFunc);
  folder
    .addBinding(cameraParams, "latitude", { min: -89.999, max: 89.999 })
    .on("change", changeFunc);
  folder
    .addBinding(cameraParams, "altitude", { min: 1, max: 19070256 })
    .on("change", changeFunc);
  folder
    .addBinding(cameraParams, "heading", { min: -180.0, max: 180.0 })
    .on("change", changeFunc);
  folder.addBinding(cameraParams, "pitch").on("change", changeFunc);
};
