import ThreeView from "@navara/three";
import {
  AxesHelper,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  Vector2,
  Vector3,
} from "three";
import {
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
  convertScreenToWorld,
  Window as NavaraWindow,
  LLE,
} from "@navara/three_api";

import { TILE_URLS } from "../../helpers/constants";

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
  view.scene.add(axesHelper);

  addRunningObject(view);
  testScreenToWorld(view);

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
  view.scene.add(sphere);

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
    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pos = convertScreenPos(view, x, y);

    if (!ball) {
      ball = placeOneBall(view, pos);
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
): Mesh | undefined => {
  if (pos) {
    const geometry = new SphereGeometry(200000);
    const material = new MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x072534,
      specular: 0x111111,
      shininess: 30,
    });

    const sphere = new Mesh(geometry, material);
    view.scene.add(sphere);
    sphere.position.set(pos.x, pos.y, pos.z);

    return sphere;
  }
};
