import ThreeView from "@navara/three";
import { AxesHelper, SphereGeometry, MeshPhongMaterial, Mesh } from "three";
import {
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
} from "@navara/three_api";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scene.add(axesHelper);

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

    const pos = geodeticToVector3(lng, lat, 1000000);
    sphere.position.set(pos.x, pos.y, pos.z);

    view.forceUpdate();
    requestAnimationFrame(animateFunc);
  };
  animateFunc();

  // vector3ToGeodetic
  const pos = geodeticToVector3(139.75711454748298, 35.67564356091717, 1000000);
  const lle = vector3ToGeodetic(pos);
  console.log(`lng: ${lle.lng}, lat: ${lle.lat}, height: ${lle.height}`);

  // degreeToRadian
  const radian = degreeToRadian(180);
  console.log(`180 degrees to radian: ${radian}`);

  // radianToDegree
  const degree = radianToDegree(radian);
  console.log(`radian ${radian} to degree: ${degree}`);
};
