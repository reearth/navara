import ThreeView, { initializeGltfLoader } from "@navara/three";
import {
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
  convertScreenToWorld,
  geodeticSurfaceNormal,
  eastNorthUpToFixedFrame,
  northEastDownToFixedFrame,
  northUpEastToFixedFrame,
  northWestUpToFixedFrame,
  Window as NavaraWindow,
  LLE,
} from "@navara/three_api";
import {
  AxesHelper,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  Vector2,
  Vector3,
  Object3D,
  ArrowHelper,
} from "three";
import { Pane } from "tweakpane";

import { TILE_URLS } from "../../helpers/constants";

const gPaneParams = {
  convertScreenToWorld: true,

  moveDistance: 0,

  transform: "eastNorthUp",
};

let gModel: Object3D | undefined = undefined;

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scenes.main.add(axesHelper);

  addCtrlPanel();
  addRunningObject(view);
  testScreenToWorld(view);

  await addTestModel(view);

  // vector3ToGeodetic
  const pos = geodeticToVector3(
    new LLE(
      degreeToRadian(35.67564356091717),
      degreeToRadian(139.75711454748298),
      1000000,
    ),
  );
  const lle = vector3ToGeodetic(pos);
  console.log(`lng: ${lle.lng}, lat: ${lle.lat}, height: ${lle.height}`);

  // degreeToRadian
  const radian = degreeToRadian(180);
  console.log(`180 degrees to radian: ${radian}`);

  // radianToDegree
  const degree = radianToDegree(radian);
  console.log(`radian ${radian} to degree: ${degree}`);
};

const addRunningObject = (view: ThreeView) => {
  const geometry = new SphereGeometry(500000);
  const material = new MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0x072534,
    specular: 0x111111,
    shininess: 30,
  });

  const sphere = new Mesh(geometry, material);
  view.scenes.main.add(sphere);

  let lng = 0.0;
  let lat = 0.0;
  let latStep = 0.01;
  const lngStep = 1;

  const animateFunc = () => {
    lng += lngStep;
    lat += latStep;
    if (lng > 360.0) lng -= 360.0;
    if (lat > 90.0) {
      latStep = -latStep;
    }

    const pos = geodeticToVector3(
      new LLE(degreeToRadian(lat), degreeToRadian(lng), 1000000),
    );
    sphere.position.set(pos.x, pos.y, pos.z);

    view.forceUpdate();
    requestAnimationFrame(animateFunc);
  };
  animateFunc();
};

const testScreenToWorld = (view: ThreeView) => {
  let ball: Mesh | undefined = undefined;

  const onMouseMove = (event: MouseEvent) => {
    if (!gPaneParams.convertScreenToWorld) {
      return;
    }

    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pos = convertScreenPos(view, x, y);

    if (!ball) {
      ball = placeOneBall(view, pos, 0x00ff00);
    } else {
      if (pos) {
        ball.position.set(pos.x, pos.y, pos.z);
        view.forceUpdate();
      }
    }
  };

  view.renderer.domElement.addEventListener("mousemove", onMouseMove);
};

const convertScreenPos = (view: ThreeView, x: number, y: number) => {
  if (!view.camera) {
    console.error("View camera is not initialized.");
    return;
  }

  const screenSize = view.screenSize;
  const pixelRatio = view.pixelRatio;

  const win = new NavaraWindow(screenSize.x, screenSize.y, pixelRatio);

  const pos = convertScreenToWorld(
    win,
    view.camera.innerCam,
    new Vector2(x, y),
  );

  return pos;
};

const placeOneBall = (
  view: ThreeView,
  pos: Vector3 | undefined,
  color: number,
): Mesh | undefined => {
  if (pos) {
    const geometry = new SphereGeometry(200000);
    const material = new MeshPhongMaterial({
      color: color,
      emissive: 0x072534,
      specular: 0x111111,
      shininess: 30,
    });

    const sphere = new Mesh(geometry, material);
    view.scenes.main.add(sphere);
    sphere.position.set(pos.x, pos.y, pos.z);

    return sphere;
  }
};

const addTestModel = async (view: ThreeView) => {
  const loader = initializeGltfLoader();
  const model = await loader.loadAsync(
    "/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf",
  );
  if (model.scene) {
    view.scenes.main.add(model.scene);

    const pos = geodeticToVector3(
      new LLE(degreeToRadian(35.3624725342), degreeToRadian(138.7306671143), 0),
    );
    const normal = geodeticSurfaceNormal(
      new LLE(degreeToRadian(35.3624725342), degreeToRadian(138.7306671143), 0),
    );

    model.scene.position.set(pos.x, pos.y, pos.z);
    model.scene.scale.set(300000, 300000, 300000);

    const arrowHelper = new ArrowHelper(normal, pos, 6000000, 0xffffff);
    view.scenes.main.add(arrowHelper);

    gModel = model.scene;
    gModel.userData.origin = pos;
    gModel.userData.normal = normal;

    // Add model's own coordinate axes with arrows
    const xAxis = new ArrowHelper(
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 0),
      5,
      0xff0000,
    );
    const yAxis = new ArrowHelper(
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 0),
      5,
      0x00ff00,
    );
    const zAxis = new ArrowHelper(
      new Vector3(0, 0, 1),
      new Vector3(0, 0, 0),
      5,
      0x0000ff,
    );
    gModel.add(xAxis);
    gModel.add(yAxis);
    gModel.add(zAxis);

    onTransformChange();
  }
};

const addCtrlPanel = () => {
  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  pane.addBinding(gPaneParams, "convertScreenToWorld");

  const fNormal = pane.addFolder({
    title: "SurfaceNormal",
    expanded: true,
  });

  fNormal
    .addBinding(gPaneParams, "moveDistance", { min: 0.0, max: 4000000.0 })
    .on("change", onMoveDistanceChange);

  const fTransform = pane.addFolder({
    title: "Transform",
    expanded: true,
  });

  fTransform
    .addBinding(gPaneParams, "transform", {
      options: {
        eastNorthUp: "eastNorthUp",
        northEastDown: "northEastDown",
        northUpEast: "northUpEast",
        northWestUp: "northWestUp",
      },
    })
    .on("change", onTransformChange);
};

const onMoveDistanceChange = () => {
  if (gModel && gModel.userData.normal && gModel.userData.origin) {
    const normal = gModel.userData.normal;
    const pos = gModel.userData.origin;

    // Move the model along the surface normal
    const newPos = new Vector3(
      pos.x + normal.x * gPaneParams.moveDistance,
      pos.y + normal.y * gPaneParams.moveDistance,
      pos.z + normal.z * gPaneParams.moveDistance,
    );

    gModel.position.set(newPos.x, newPos.y, newPos.z);
  }
};

const onTransformChange = () => {
  if (!gModel || !gModel.userData.origin) {
    return;
  }

  gModel.position.set(0, 0, 0);
  gModel.rotation.set(0, 0, 0);
  gModel.scale.set(300000, 300000, 300000);

  let transformMatrix;
  switch (gPaneParams.transform) {
    case "eastNorthUp":
      transformMatrix = eastNorthUpToFixedFrame(gModel.userData.origin);
      break;
    case "northEastDown":
      transformMatrix = northEastDownToFixedFrame(gModel.userData.origin);
      break;
    case "northUpEast":
      transformMatrix = northUpEastToFixedFrame(gModel.userData.origin);
      break;
    case "northWestUp":
      transformMatrix = northWestUpToFixedFrame(gModel.userData.origin);
      break;
    default:
      transformMatrix = eastNorthUpToFixedFrame(gModel.userData.origin);
  }

  gModel.applyMatrix4(transformMatrix);

  if (gModel.userData.normal) {
    const moveOffset = gModel.userData.normal
      .clone()
      .multiplyScalar(gPaneParams.moveDistance);
    gModel.position.add(moveOffset);
  }
};
