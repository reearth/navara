import ThreeView, {
  type CameraOrientation,
  CameraDirection,
  JAPAN_GSI_ELEVATION_DECODER,
  type LatLngHeight,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { Pane, FolderApi } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";

const gCameraParams = {
  longitude: 139.75711454748298,
  latitude: 35.67564356091717,
  altitude: 902.0,
  heading: 64.41840149763287, // -180 to 180
  pitch: -36.00000121921312, // -180 to 0
  roll: 0, // -180 to 180
};

let gCameraParamsPane: FolderApi | undefined = undefined;
let gIgnoreChange = false;

export type LayerDescriptions = DefaultLayerDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  await view.addPlugin(plugin);
  await view.init();

  view.atmosphere.date.setHours(8);

  plugin.addDefaultPhotorealLayers();

  view.addLayer({
    type: "mesh",
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  view.setCamera({
    lng: 139.75711454748298,
    lat: 35.67564356091717,
    height: 902.0,
    heading: 64.41840149763287, // -180 to 180
    pitch: -36.00000121921312, // -180 to 0
    roll: 0, // -180 to 180
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {},
  });

  view.camera.on("movestart", () => {
    console.log("movestart");
  });
  view.camera.on("move", () => {
    console.log("move");
    const position = view.camera.positionGeographic;
    const orientation = view.camera.orientation;
    updateCameraParamsToPane({ ...position, ...orientation });
  });
  view.camera.on("moveend", () => {
    console.log("moveend");
    const position = view.camera.positionGeographic;
    const orientation = view.camera.orientation;

    updateCameraParamsToPane({ ...position, ...orientation });
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addDateControl(view, pane);
  addCameraControl(view, pane);

  addChangeCameraOption(pane, view);
  addMoveCameraOption(pane, view);
  addMoveCameraWithDirOption(pane, view);
  addFlyToOption(pane, view);
  addLookAtOption(pane, view);
  addRotateOption(pane, view);
  addCameraControlOptions(pane, view);

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.openstreetmap]);
};

const addChangeCameraOption = (
  pane: Pane,
  view: ThreeView<LayerDescriptions>,
) => {
  const cameraParams = gCameraParams;

  const folder = pane.addFolder({
    title: "Change Camera",
    expanded: false,
  });

  gCameraParamsPane = folder;

  const changeFunc = () => {
    if (gIgnoreChange) {
      return;
    }
    view.setCamera({
      lng: cameraParams.longitude,
      lat: cameraParams.latitude,
      height: cameraParams.altitude,
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
  folder.addBinding(cameraParams, "heading").on("change", changeFunc);
  folder.addBinding(cameraParams, "pitch").on("change", changeFunc);
  folder.addBinding(cameraParams, "roll").on("change", changeFunc);
};

const addMoveCameraOption = (
  pane: Pane,
  view: ThreeView<LayerDescriptions>,
) => {
  const cameraParams = {
    amount: 100,
  };
  const folder = pane.addFolder({
    title: "Move Camera",
    expanded: false,
  });

  const clickFunc = (move: CameraDirection) => {
    view.moveCamera(move, cameraParams.amount);
  };

  folder.addBinding(cameraParams, "amount");

  folder.addButton({ title: "Forward", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Forward);
  });
  folder.addButton({ title: "Backward", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Backward);
  });
  folder.addButton({ title: "Up", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Up);
  });
  folder.addButton({ title: "Down", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Down);
  });
  folder.addButton({ title: "Left", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Left);
  });
  folder.addButton({ title: "Right", label: "" }).on("click", () => {
    clickFunc(CameraDirection.Right);
  });
};

const addMoveCameraWithDirOption = (
  pane: Pane,
  view: ThreeView<LayerDescriptions>,
) => {
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

const addFlyToOption = (pane: Pane, view: ThreeView<LayerDescriptions>) => {
  const cameraParams = {
    longitude: 127.7,
    latitude: 26.2,
    altitude: 10000.0,
    heading: 0, // -180 to 180
    pitch: -90.0, // -180 to 0
    roll: 0, // -180 to 180
    duration: 2000,
    max_height: 0,
  };
  const folder = pane.addFolder({
    title: "Fly To",
    expanded: false,
  });

  const clickFunc = () => {
    view.flyTo(
      {
        lng: cameraParams.longitude,
        lat: cameraParams.latitude,
        height: cameraParams.altitude,
        heading: cameraParams.heading,
        pitch: cameraParams.pitch,
        roll: cameraParams.roll,
      },
      cameraParams.duration,
      cameraParams.max_height > 1 ? cameraParams.max_height : undefined,
    );
  };

  folder.addBinding(cameraParams, "longitude", { min: -180.0, max: 180.0 });
  folder.addBinding(cameraParams, "latitude", { min: -89.999, max: 89.999 });
  folder.addBinding(cameraParams, "altitude", { min: 1, max: 19070256 });
  folder.addBinding(cameraParams, "heading", { min: -180.0, max: 180.0 });
  folder.addBinding(cameraParams, "pitch", { min: -180.0, max: 0.0 });
  folder.addBinding(cameraParams, "roll", { min: -180.0, max: 180.0 });
  folder.addBinding(cameraParams, "duration");
  folder.addBinding(cameraParams, "max_height");

  folder.addButton({ title: "Fly To", label: "" }).on("click", () => {
    clickFunc();
  });
};

const addLookAtOption = (pane: Pane, view: ThreeView<LayerDescriptions>) => {
  const cameraParams = {
    longitude: 138.7306671143,
    latitude: 35.3624725342,
    altitude: 0.0,
    offset_x: 0.0,
    offset_y: -10000.0,
    offset_z: 10000.0,
  };
  const folder = pane.addFolder({
    title: "Look At",
    expanded: false,
  });

  const clickFunc = () => {
    view.lookAt(
      {
        lat: cameraParams.latitude,
        lng: cameraParams.longitude,
        height: cameraParams.altitude,
      },
      new Vector3(
        cameraParams.offset_x,
        cameraParams.offset_y,
        cameraParams.offset_z,
      ),
    );
  };

  folder.addBinding(cameraParams, "longitude", { min: -180.0, max: 180.0 });
  folder.addBinding(cameraParams, "latitude", { min: -89.999, max: 89.999 });
  folder.addBinding(cameraParams, "altitude", { min: 1, max: 19070256 });
  folder.addBinding(cameraParams, "offset_x");
  folder.addBinding(cameraParams, "offset_y");
  folder.addBinding(cameraParams, "offset_z");

  folder.addButton({ title: "Look At", label: "" }).on("click", () => {
    clickFunc();
  });
};

const addCameraControlOptions = (
  pane: Pane,
  view: ThreeView<LayerDescriptions>,
) => {
  const controlParams = {
    autoAdjustNearFar: true,
    minimumZoomDistance: 6356752,
    maximumZoomDistance: 63567523,
    spinSpeed: 2.0,
    zoomSpeed: 0.6,
    spinDuration: 500.0,
    zoomDuration: 100.0,
    translateDuration: 500.0,
  };

  const frustumParams = {
    near: view.camera.near,
    far: view.camera.far,
  };

  // Default values when autoAdjustNearFar is disabled (mid-altitude defaults)
  const DEFAULT_NEAR = 100.0;
  const DEFAULT_FAR = 1e8;

  const folder = pane.addFolder({
    title: "Camera Control Options",
    expanded: false,
  });

  const applyOptions = () => {
    view.camera.options = controlParams;
  };

  // Display current near/far values
  const nearBinding = folder.addBinding(frustumParams, "near", {
    label: "near",
    disabled: controlParams.autoAdjustNearFar,
  });
  const farBinding = folder.addBinding(frustumParams, "far", {
    label: "far",
    disabled: controlParams.autoAdjustNearFar,
  });

  // Apply near/far when manually changed
  nearBinding.on("change", () => {
    if (!controlParams.autoAdjustNearFar) {
      view.camera.near = frustumParams.near;
    }
  });
  farBinding.on("change", () => {
    if (!controlParams.autoAdjustNearFar) {
      view.camera.far = frustumParams.far;
    }
  });

  // Update near/far display when frustum changes
  view.camera.on("frustumChanged", () => {
    frustumParams.near = view.camera.near;
    frustumParams.far = view.camera.far;
    folder.refresh();
  });

  folder.addBinding(controlParams, "autoAdjustNearFar").on("change", () => {
    applyOptions();
    // Update disabled state of near/far inputs
    nearBinding.disabled = controlParams.autoAdjustNearFar;
    farBinding.disabled = controlParams.autoAdjustNearFar;

    // Set default near/far when disabling auto adjust
    if (!controlParams.autoAdjustNearFar) {
      view.camera.near = DEFAULT_NEAR;
      view.camera.far = DEFAULT_FAR;
      frustumParams.near = DEFAULT_NEAR;
      frustumParams.far = DEFAULT_FAR;
      folder.refresh();
    }
  });
  folder
    .addBinding(controlParams, "minimumZoomDistance", {
      min: 1,
      max: 63567523,
    })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "maximumZoomDistance", {
      min: 1,
      max: 635675230,
    })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "spinSpeed", { min: 0.1, max: 10.0 })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "zoomSpeed", { min: 0.1, max: 5.0 })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "spinDuration", { min: 0, max: 2000 })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "zoomDuration", { min: 0, max: 1000 })
    .on("change", applyOptions);
  folder
    .addBinding(controlParams, "translateDuration", { min: 0, max: 2000 })
    .on("change", applyOptions);
};

const addRotateOption = (pane: Pane, view: ThreeView<LayerDescriptions>) => {
  const cameraParams = {
    axis_x: 0.0,
    axis_y: 0.0,
    axis_z: 0.0,
    angle_rad: 0.002,
  };
  const folder = pane.addFolder({
    title: "Rotate",
    expanded: true,
  });

  folder.addBinding(cameraParams, "axis_x");
  folder.addBinding(cameraParams, "axis_y");
  folder.addBinding(cameraParams, "axis_z");
  folder.addBinding(cameraParams, "angle_rad");

  const clickFunc = () => {
    view.rotateAroundAxis(
      new Vector3(
        cameraParams.axis_x,
        cameraParams.axis_y,
        cameraParams.axis_z,
      ),
      cameraParams.angle_rad,
    );
  };

  folder.addButton({ title: "Rotate", label: "" }).on("click", () => {
    clickFunc();
  });

  let isAnimating = false;
  const animateFunc = () => {
    if (isAnimating) {
      clickFunc();
    }
    requestAnimationFrame(animateFunc);
  };
  animateFunc();

  addToggleButton(folder, "Animate", "Stop", (title: string) => {
    isAnimating = title === "Animate";
  });
};

const addToggleButton = (
  folder: FolderApi,
  titleA: string,
  titleB: string,
  f: (title: string) => void,
) => {
  const button = folder.addButton({
    title: titleA,
    label: "",
  });

  button.on("click", () => {
    f(button.title);
    button.title = button.title === titleA ? titleB : titleA;
  });
};

const updateCameraParamsToPane = (
  position: (LatLngHeight & CameraOrientation) | undefined,
) => {
  const cameraParams = gCameraParams;

  if (position && position.lng) {
    cameraParams.longitude = position.lng;
  }
  if (position && position.lat) {
    cameraParams.latitude = position.lat;
  }
  if (position && position.height) {
    cameraParams.altitude = position.height;
  }

  if (position && position.heading) {
    cameraParams.heading = position.heading;
  }
  if (position && position.pitch) {
    cameraParams.pitch = position.pitch;
  }
  if (position && position.roll) {
    cameraParams.roll = position.roll;
  }

  gIgnoreChange = true;
  gCameraParamsPane?.refresh();
  gIgnoreChange = false;
};
