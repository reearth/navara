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
  getPlaneFromPointNormal,
  getHeightFromEllipsoid,
  getPickRay,
  getRayPlaneIntersection,
  Window as NavaraWindow,
  LLE,
  EllipsoidGeodesic,
} from "@navara/three_api";
import {
  AxesHelper,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  Object3D,
  ArrowHelper,
  CylinderGeometry,
} from "three";
import { Pane, FolderApi } from "tweakpane";
import type { Nullable } from "@navara/core";
import { TILE_URLS } from "../../helpers/constants";

const gPaneParams = {
  convertScreenToWorld: false,
  moveDistance: 0,
  transform: "eastNorthUp",

  lngStart: 138.7306671143,
  latStart: 35.3624725342,
  lngEnd: 86.925,
  latEnd: 27.9881,
  distance: 0,
};

let gModel: Nullable<Object3D> = undefined;
let gPolylineMesh: Nullable<Mesh> = undefined;
let gLastCameraDistance = 0;
let gPolylinePoints: Vector3[] = [];
let gView: Nullable<ThreeView> = undefined;
let gFolderDist: Nullable<FolderApi> = null;

export const run = async (view: ThreeView) => {
  await view.init();

  gView = view;

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

  createPolylineMesh(view);
  addCameraListener(view);
  addCtrlPanel();
  addRunningObject(view);
  testScreenToWorld(view);
  testRayPlane(view);

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

  onDistPosChange();
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

  gFolderDist = pane.addFolder({
    title: "Distance",
    expanded: true,
  });

  gFolderDist
    .addBinding(gPaneParams, "lngStart", { min: -180.0, max: 180.0 })
    .on("change", onDistPosChange);
  gFolderDist
    .addBinding(gPaneParams, "latStart", { min: -90.0, max: 90.0 })
    .on("change", onDistPosChange);
  gFolderDist
    .addBinding(gPaneParams, "lngEnd", { min: -180.0, max: 180.0 })
    .on("change", onDistPosChange);
  gFolderDist
    .addBinding(gPaneParams, "latEnd", { min: -90.0, max: 90.0 })
    .on("change", onDistPosChange);
  gFolderDist.addBinding(gPaneParams, "distance");
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

const testRayPlane = (view: ThreeView) => {
  let center: Vector3 | undefined = undefined;
  let radius: number | undefined = undefined;
  let height: number | undefined = undefined;
  let normal: Vector3 | undefined = undefined;
  let btmDist: number | undefined = undefined;
  let cylinder: Mesh | undefined = undefined;
  let bMouseMoved = false;

  const onMouseDown = (_e: MouseEvent) => {
    bMouseMoved = false;
  };
  const onMouseMove = (event: MouseEvent) => {
    bMouseMoved = true;

    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const screenSize = view.screenSize;
    const pixelRatio = view.pixelRatio;

    if (center && normal && !radius) {
      const win = new NavaraWindow(screenSize.x, screenSize.y, pixelRatio);
      const ray = getPickRay(win, view.camera.innerCam, new Vector2(x, y));

      const btmPlane = getPlaneFromPointNormal(center, normal);
      const intersectPt = getRayPlaneIntersection(ray, btmPlane);
      if (intersectPt) {
        btmDist = intersectPt.distanceTo(center);
        if (cylinder) {
          cylinder.scale.set(btmDist, 1, btmDist);
        }
      }
      return;
    }

    if (center && normal && radius) {
      const win = new NavaraWindow(screenSize.x, screenSize.y, pixelRatio);
      const ray = getPickRay(win, view.camera.innerCam, new Vector2(x, y));
      const rayDir = new Vector3(
        ray.direction.x,
        ray.direction.y,
        ray.direction.z,
      );
      const planeNormal = rayDir.cross(normal).cross(normal).normalize();
      const plane = getPlaneFromPointNormal(center, planeNormal);
      const intersectPt = getRayPlaneIntersection(ray, plane);
      if (intersectPt) {
        height = getHeightFromEllipsoid(intersectPt);
        if (cylinder) {
          cylinder.scale.set(radius, Math.max(1, height), radius);
        }
      }
    }
  };
  const onMouseUp = (event: MouseEvent) => {
    if (bMouseMoved) {
      return;
    }

    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pos = convertScreenPos(view, x, y);

    if (!center && pos) {
      center = pos;

      const lle = vector3ToGeodetic(pos);
      normal = geodeticSurfaceNormal(lle);

      cylinder = makeCylinder(view, center);
      return;
    }

    if (!radius && btmDist && pos) {
      radius = btmDist;
      return;
    }

    center = undefined;
    radius = undefined;
    normal = undefined;
    cylinder = undefined;
  };

  view.renderer.domElement.addEventListener("mousedown", onMouseDown);
  view.renderer.domElement.addEventListener("mousemove", onMouseMove);
  view.renderer.domElement.addEventListener("mouseup", onMouseUp);
};

const makeCylinder = (view: ThreeView, center: Vector3): Mesh => {
  const geometry = new CylinderGeometry(
    1, // top radius
    1, // bottom radius
    1, // height
    32, // radial segments
    1, // height segments
    false, // open ended
    0, // theta start
    Math.PI * 2, // theta length
  );
  geometry.translate(0, 0.5, 0);

  const material = new MeshPhongMaterial({
    color: 0xffff00,
  });

  const cylinder = new Mesh(geometry, material);
  view.scenes.main.add(cylinder);

  const transformMatrix = northUpEastToFixedFrame(center);
  cylinder.applyMatrix4(transformMatrix);

  return cylinder;
};

const onDistPosChange = () => {
  const ellipGeo = new EllipsoidGeodesic(
    new LLE(
      degreeToRadian(gPaneParams.latStart),
      degreeToRadian(gPaneParams.lngStart),
      0,
    ),
    new LLE(
      degreeToRadian(gPaneParams.latEnd),
      degreeToRadian(gPaneParams.lngEnd),
      0,
    ),
  );

  gPaneParams.distance = ellipGeo.distance;

  gFolderDist?.refresh();

  const LINE_POINT_COUNT = 20;
  const points = ellipGeo.interpolateGeodeticPoints(
    ellipGeo.distance / LINE_POINT_COUNT,
  );

  // Update polyline mesh
  if (gPolylineMesh) {
    const curvePoints = [];
    for (const point of points) {
      if (point) {
        const pos = geodeticToVector3(new LLE(point.lat, point.lng, 1000));
        curvePoints.push(pos);
      }
    }

    // Store points and update geometry
    if (curvePoints.length >= 2 && gView) {
      gPolylinePoints = curvePoints;
      updatePolylineMesh(gView, curvePoints);
    }
  }
};

const updatePolylineMesh = (view: ThreeView, curvePoints: Vector3[]) => {
  if (!gPolylineMesh || !view.camera) return;

  // Calculate appropriate tube radius based on camera distance to keep visual thickness constant
  const centerPoint = curvePoints[Math.floor(curvePoints.length / 2)];
  const cameraDistance = view.camera.innerCam.position.distanceTo(centerPoint);

  // Store current distance for camera change detection
  gLastCameraDistance = cameraDistance;

  const visualThickness = 0.002; // How thick the line appears on screen
  const finalRadius = cameraDistance * visualThickness;

  // Set reasonable bounds to prevent extremely thin or thick tubes
  const minRadius = 10;
  const maxRadius = 100000;
  const clampedRadius = Math.max(minRadius, Math.min(maxRadius, finalRadius));

  const curve = new CatmullRomCurve3(curvePoints);
  curve.tension = 0.5; // Adjust tension for smoother curves (0-1)

  // Use more segments for smoother geometry
  const tubularSegments = Math.max(64, curvePoints.length * 4); // More segments along the curve
  const radialSegments = 16; // More radial segments for rounder cross-section

  const newGeometry = new TubeGeometry(
    curve,
    tubularSegments,
    clampedRadius,
    radialSegments,
    false,
  );

  gPolylineMesh.geometry.dispose();
  gPolylineMesh.geometry = newGeometry;
};

const addCameraListener = (view: ThreeView) => {
  // Update tube thickness when camera moves
  view.camera.on("move", () => {
    if (!gPolylineMesh || !view.camera || gPolylinePoints.length === 0) return;

    const centerPoint = gPolylinePoints[Math.floor(gPolylinePoints.length / 2)];
    const currentDistance =
      view.camera.innerCam.position.distanceTo(centerPoint);

    // Only update if camera distance changed significantly (more than 10%)
    if (gLastCameraDistance > 0) {
      const distanceChange =
        Math.abs(currentDistance - gLastCameraDistance) / gLastCameraDistance;
      if (distanceChange > 0.1) {
        updatePolylineMesh(view, gPolylinePoints);
      }
    }
  });
};

const createPolylineMesh = (view: ThreeView) => {
  // Create initial points for the curve
  const points = Array.from({ length: 2 }, () => new Vector3(0, 0, 0));

  // Create curve and tube geometry
  const curve = new CatmullRomCurve3(points);
  curve.tension = 0.5; // Adjust tension for smoother curves
  const geometry = new TubeGeometry(curve, 64, 1, 16, false); // More segments for initial geometry
  const material = new MeshPhongMaterial({
    color: 0x00ffff,
  });

  gPolylineMesh = new Mesh(geometry, material);
  view.scenes.main.add(gPolylineMesh);
};
