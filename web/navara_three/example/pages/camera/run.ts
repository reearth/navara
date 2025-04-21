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

  view.setCamera({
    longitude: 139.75711454748298,
    latitude: 35.67564356091717,
    altitude: 902.0,
    heading: 64.41840149763287, // -180 to 180
    pitch: -36.00000121921312, // -180 to 0
    roll: 0, // -180 to 180
  });

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
  addMoveCameraOption(pane, view);
  addMoveCameraWithDirOption(pane, view);
};

const addChangeCameraOption = (pane: Pane, view: ThreeView) => {
  const cameraParams = {
    longitude: 139.75711454748298,
    latitude: 35.67564356091717,
    altitude: 902.0,
    heading: 64.41840149763287, // -180 to 180
    pitch: -36.00000121921312, // -180 to 0
    roll: 0, // -180 to 180
  };
  const folder = pane.addFolder({
    title: "Change Camera",
    expanded: false,
  });

  const changeFunc = () => {
    view.setCamera({
      longitude: cameraParams.longitude,
      latitude: cameraParams.latitude,
      altitude: cameraParams.altitude,
      heading: cameraParams.heading,
      pitch: cameraParams.pitch,
      roll: cameraParams.roll,
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
  folder
    .addBinding(cameraParams, "pitch", { min: -180.0, max: 0.0 })
    .on("change", changeFunc);
  folder
    .addBinding(cameraParams, "roll", { min: -180.0, max: 180.0 })
    .on("change", changeFunc);
};

const addMoveCameraOption = (pane: Pane, view: ThreeView) => {
  const cameraParams = {
    amount: 100,
  };
  const folder = pane.addFolder({
    title: "Move Camera",
    expanded: false,
  });

  const clickFunc = (move: string) => {
    view.moveCamera(move, cameraParams.amount);
  };

  folder.addBinding(cameraParams, "amount");

  folder.addButton({ title: "Forward", label: "" }).on("click", () => {
    clickFunc("Forward");
  });
  folder.addButton({ title: "Backward", label: "" }).on("click", () => {
    clickFunc("Backward");
  });
  folder.addButton({ title: "Up", label: "" }).on("click", () => {
    clickFunc("Up");
  });
  folder.addButton({ title: "Down", label: "" }).on("click", () => {
    clickFunc("Down");
  });
  folder.addButton({ title: "Left", label: "" }).on("click", () => {
    clickFunc("Left");
  });
  folder.addButton({ title: "Right", label: "" }).on("click", () => {
    clickFunc("Right");
  });
};

const addMoveCameraWithDirOption = (pane: Pane, view: ThreeView) => {
  const cameraParams = {
    amount: 100,
    dir_x: 0,
    dir_y: 1,
    dir_z: 0,
  };

  const folder = pane.addFolder({
    title: "Move Camera With Direction",
    expanded: false,
  });

  folder.addBinding(cameraParams, "amount");
  folder.addBinding(cameraParams, "dir_x");
  folder.addBinding(cameraParams, "dir_y");
  folder.addBinding(cameraParams, "dir_z");

  const clickFunc = () => {
    view.moveCameraWithDirection(
      [cameraParams.dir_x, cameraParams.dir_y, cameraParams.dir_z],
      cameraParams.amount,
    );
  };

  folder.addButton({ title: "Move", label: "" }).on("click", () => {
    clickFunc();
  });
};
