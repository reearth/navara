import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerHandle,
  type PickedFeature,
  type SphereMeshLayer,
  type TubeMeshLayer,
  type CylinderMeshLayer,
  type GLTFModelLayer,
  type Nullable,
  type XYZ,
} from "@navara/three";
import {
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
  convertScreenToWorld,
  convertWorldToScreen,
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
import { Mesh, Vector2, Vector3, Object3D, Group, ArrowHelper } from "three";
import { Pane, FolderApi } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

import { FloatingDialog } from "./dialog";

const gPaneParams = {
  convertScreenToWorld: false,
  extrudeCylinder: false,
  moveDistance: 0,
  transform: "eastNorthUp",

  lngStart: 127.6809,
  latStart: 26.2124,
  lngEnd: 86.925,
  latEnd: 27.9881,
  distance: 0,
  interpolate: 0,

  sampleLng: 0,
  sampleLat: 0,
  sampleTerrainHeight: 0,

  fujiHeight: 0,
  fujiRegistered: true,
  kitaHeight: 0,
  kitaRegistered: true,

  fov: 50,
  near: 100,
  far: 100000000,
};

const gFujiPos = [35.3624725342, 138.7306671143];
const gKitaPos = [35.6744, 138.2392];

let gModelNormalHandle: Nullable<LayerHandle<GLTFModelLayer>> = undefined;
let gModelFujiHandle: Nullable<LayerHandle<GLTFModelLayer>> = undefined;
let gPolylineLayer: Nullable<LayerHandle<TubeMeshLayer>> = undefined;
let gMouseBall: Nullable<Mesh> = undefined;
let gInterBall: Nullable<Mesh> = undefined;
let gLastCameraDistance = 0;
let gPolylinePoints: XYZ[] = [];
let gView: Nullable<ThreeView> = undefined;
let gFolderDist: Nullable<FolderApi> = null;
let gFolderSample: Nullable<FolderApi> = null;
let gFolderHeightEvent: Nullable<FolderApi> = null;
let gFujiUnregister: Nullable<() => void> = null;
let gKitaUnregister: Nullable<() => void> = null;
let gPickedFeature: Nullable<PickedFeature> = null;
let gPickedPos: Nullable<Vector3> = null;

const gPopup = new FloatingDialog();

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  gView = view;

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_URLS.openstreetmap,
    },
    raster_tile: {},
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
    },
  });

  view.addLayer({
    type: "mesh",
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);

  addDateControl(view, pane);

  // Create polyline between two points on elipsoid surface
  createPolylineMesh(view);

  // adjust the polyline width based on camera distance
  addCameraListener(view);

  // initialize the control panel
  addCtrlPanel(pane);

  // create a ball running on the surface
  addRunningObject(view);

  // add a ball following mouse position
  testScreenToWorld(view);

  // extrude a cylinder from the elipsoid surface
  testRayPlane(view);

  // sample terrain height at mouse position
  testSampleTerrainHeight(view);

  // handle pick event and pop up information
  testShowModelInfo(view);

  // add a model for testing surface normal
  addTestModelForNormal(view);

  // add a model for testing terrain height
  addTestModelForTerrainHeight(view);

  gMouseBall = placeOneBall(view, new Vector3(0, 0, 0), 0x00ff00);
  gInterBall = placeOneBall(view, new Vector3(0, 0, 0), 0xff0000);
  onDistPosChange();
  onRegisterChange();
};

const addRunningObject = (view: ThreeView) => {
  const sphere = placeOneBall(view, new Vector3(0, 0, 0), 0xffffff);
  if (!sphere) {
    return;
  }

  sphere.scale.set(300000, 300000, 300000);

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
  const onMouseMove = (event: MouseEvent) => {
    if (!gPaneParams.convertScreenToWorld) {
      return;
    }

    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pos = view.pickTerrainPosition(x, y);

    if (gMouseBall && pos) {
      gMouseBall.position.set(pos.x, pos.y, pos.z);
      view.forceUpdate();
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

  const pos = convertScreenToWorld(win, view.camera.raw, new Vector2(x, y));

  return pos;
};

const placeOneBall = (
  view: ThreeView,
  pos: Vector3 | undefined,
  color: number,
): Mesh | undefined => {
  if (pos) {
    const sphereLayer = view.addLayer<SphereMeshLayer>({
      type: "mesh",
      sphere: {
        radius: 1,
        color: color,
        emissive: 0x072534,
      },
      position: { x: pos.x, y: pos.y, z: pos.z },
    });

    // sphereLayer is a LayerHandle for mesh layers
    return sphereLayer.ref.raw;
  }
};

const addTestModelForNormal = (view: ThreeView) => {
  const pos = geodeticToVector3(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );
  const normal = geodeticSurfaceNormal(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );

  // Add GLTF model using GLTFModelLayer with URL
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: "/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf",
    },
    scale: { x: 300000, y: 300000, z: 300000 },
    position: { x: pos.x, y: pos.y, z: pos.z },
  });

  // Add arrow helper
  view.addLayer({
    type: "mesh",
    arrowHelper: {
      direction: normal,
      origin: pos,
      length: 5000000,
      color: 0xffffff,
      headLength: 400000,
      headWidth: 70000,
    },
  });

  // Store reference to the model layer handle
  gModelNormalHandle = modelLayer;
  if (gModelNormalHandle.ref && gModelNormalHandle.ref.raw) {
    gModelNormalHandle.ref.raw.userData.origin = pos;
    gModelNormalHandle.ref.raw.userData.normal = normal;

    // Add axes when model loads
    gModelNormalHandle.ref.on("load", () => {
      if (
        gModelNormalHandle?.ref?.raw &&
        gModelNormalHandle.ref.raw.children.length > 0
      ) {
        addAxisToModel(gModelNormalHandle.ref.raw.children[0] as Group);
        onTransformChange();
      }
    });
  }
};

const addTestModelForTerrainHeight = (view: ThreeView) => {
  const pos = geodeticToVector3(
    new LLE(degreeToRadian(gFujiPos[0]), degreeToRadian(gFujiPos[1]), 0),
  );

  const transformMatrix = northUpEastToFixedFrame(pos);

  // Add the model using GLTFModelLayer with URL
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: "/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf",
    },
    scale: new Vector3().setScalar(200),
    position: pos,
  });

  // Store reference to the model layer handle
  gModelFujiHandle = modelLayer;

  // Apply the transform matrix after model loads
  gModelFujiHandle.ref.on("load", () => {
    if (
      gModelFujiHandle?.ref?.raw &&
      gModelFujiHandle.ref.raw.children.length > 0
    ) {
      // Reset position first since we're applying the matrix
      gModelFujiHandle.update({ position: { x: 0, y: 0, z: 0 } });
      gModelFujiHandle.ref.raw.applyMatrix4(transformMatrix);
      addAxisToModel(gModelFujiHandle.ref.raw.children[0] as Group);
    }
  });
};

const addAxisToModel = (model: Object3D) => {
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
  model.add(xAxis);
  model.add(yAxis);
  model.add(zAxis);
};

const addCtrlPanel = (pane: Pane) => {
  pane.addBinding(gPaneParams, "convertScreenToWorld");
  pane.addBinding(gPaneParams, "extrudeCylinder");

  const fNormal = pane.addFolder({
    title: "SurfaceNormal",
    expanded: false,
  });

  fNormal
    .addBinding(gPaneParams, "moveDistance", { min: 0.0, max: 4000000.0 })
    .on("change", onMoveDistanceChange);

  const fTransform = pane.addFolder({
    title: "Transform",
    expanded: false,
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
    expanded: false,
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
  gFolderDist
    .addBinding(gPaneParams, "interpolate", {
      min: 0.0,
      max: 1.0,
      step: 0.001,
    })
    .on("change", onDistPosChange);

  gFolderSample = pane.addFolder({
    title: "SampleTerrainHeight",
    expanded: false,
  });
  gFolderSample.addBinding(gPaneParams, "sampleLng", { label: "Longitude" });
  gFolderSample.addBinding(gPaneParams, "sampleLat", { label: "Latitude" });
  gFolderSample.addBinding(gPaneParams, "sampleTerrainHeight", {
    label: "Height",
  });

  gFolderHeightEvent = pane.addFolder({
    title: "TerrainHeightEvent",
    expanded: false,
  });
  gFolderHeightEvent.addBinding(gPaneParams, "fujiHeight", { label: "富士山" });
  gFolderHeightEvent
    .addBinding(gPaneParams, "fujiRegistered", { label: "register" })
    .on("change", onRegisterChange);
  gFolderHeightEvent.addBlade({ view: "separator" });
  gFolderHeightEvent.addBinding(gPaneParams, "kitaHeight", { label: "北岳" });
  gFolderHeightEvent
    .addBinding(gPaneParams, "kitaRegistered", { label: "register" })
    .on("change", onRegisterChange);

  const fFrustum = pane.addFolder({
    title: "Frustum",
    expanded: true,
  });
  fFrustum.addBinding(gPaneParams, "fov").on("change", onFovChange);
  fFrustum.addBinding(gPaneParams, "near").on("change", onNearChange);
  fFrustum.addBinding(gPaneParams, "far").on("change", onFarChange);
};

const onMoveDistanceChange = () => {
  if (
    gModelNormalHandle?.ref?.raw &&
    gModelNormalHandle.ref.raw.userData.normal &&
    gModelNormalHandle.ref.raw.userData.origin
  ) {
    const normal = gModelNormalHandle.ref.raw.userData.normal;
    const pos = gModelNormalHandle.ref.raw.userData.origin;

    // Move the model along the surface normal
    const newPos = new Vector3(
      pos.x + normal.x * gPaneParams.moveDistance,
      pos.y + normal.y * gPaneParams.moveDistance,
      pos.z + normal.z * gPaneParams.moveDistance,
    );

    // Use update() method instead of direct manipulation
    gModelNormalHandle.update({ position: newPos });
  }
};

const onTransformChange = () => {
  if (
    !gModelNormalHandle?.ref?.raw ||
    !gModelNormalHandle.ref.raw.userData.origin
  ) {
    return;
  }

  // Reset position, rotation, and scale using update()
  gModelNormalHandle.update({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 300000, y: 300000, z: 300000 },
  });

  let transformMatrix;
  switch (gPaneParams.transform) {
    case "eastNorthUp":
      transformMatrix = eastNorthUpToFixedFrame(
        gModelNormalHandle.ref.raw.userData.origin,
      );
      break;
    case "northEastDown":
      transformMatrix = northEastDownToFixedFrame(
        gModelNormalHandle.ref.raw.userData.origin,
      );
      break;
    case "northUpEast":
      transformMatrix = northUpEastToFixedFrame(
        gModelNormalHandle.ref.raw.userData.origin,
      );
      break;
    case "northWestUp":
      transformMatrix = northWestUpToFixedFrame(
        gModelNormalHandle.ref.raw.userData.origin,
      );
      break;
    default:
      transformMatrix = eastNorthUpToFixedFrame(
        gModelNormalHandle.ref.raw.userData.origin,
      );
  }

  gModelNormalHandle.ref.raw.applyMatrix4(transformMatrix);

  if (gModelNormalHandle.ref.raw.userData.normal) {
    const moveOffset = gModelNormalHandle.ref.raw.userData.normal
      .clone()
      .multiplyScalar(gPaneParams.moveDistance);
    // Get current position and add offset
    const currentPos = gModelNormalHandle.ref.raw.position.clone();
    currentPos.add(moveOffset);
    gModelNormalHandle.update({ position: currentPos });
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
      const ray = getPickRay(win, view.camera.raw, new Vector2(x, y));

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
      const ray = getPickRay(win, view.camera.raw, new Vector2(x, y));
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
    if (bMouseMoved || !gPaneParams.extrudeCylinder) {
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

const makeCylinder = (view: ThreeView, center: Vector3): Mesh | undefined => {
  const cylinderLayer = view.addLayer<CylinderMeshLayer>({
    type: "mesh",
    cylinder: {
      radiusTop: 1,
      radiusBottom: 1,
      height: 1,
      radialSegments: 32,
      heightSegments: 1,
      openEnded: false,
      thetaStart: 0,
      thetaLength: Math.PI * 2,
      color: 0xffff00,
    },
  });

  const cylinder = cylinderLayer.ref.raw;

  if (cylinder) {
    // Translate the cylinder so its base is at the origin
    cylinder.geometry.translate(0, 0.5, 0);

    const transformMatrix = northUpEastToFixedFrame(center);
    cylinder.applyMatrix4(transformMatrix);
  }

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

  const points = ellipGeo.interpolateGeodeticPoints(
    gPaneParams.distance * 0.01,
  );

  // Update polyline mesh
  if (gPolylineLayer) {
    const curvePoints: XYZ[] = [];
    for (const point of points) {
      if (point) {
        const pos = geodeticToVector3(new LLE(point.lat, point.lng, 1000));
        curvePoints.push(pos);
      }
    }

    // Store points and update geometry
    if (curvePoints.length >= 2 && gView) {
      gPolylinePoints = curvePoints;
      requestAnimationFrame(() => {
        if (!gView) return;
        updatePolylineMesh(gView, curvePoints);
      });

      // update interpolated point
      const interDist = gPaneParams.distance * gPaneParams.interpolate;
      const interPoint = ellipGeo.interpolateDistance(interDist);
      const pos = geodeticToVector3(
        new LLE(interPoint.lat, interPoint.lng, 1000),
      );
      gInterBall?.position.set(pos.x, pos.y, pos.z);
    }
  }
};

const updatePolylineMesh = (view: ThreeView, curvePoints: XYZ[]) => {
  if (!gPolylineLayer) return;

  // Calculate appropriate tube radius based on camera distance to keep visual thickness constant
  const centerPoint = new Vector3(0, 0, 0);
  const polarRadius = 6356752;

  // The calculation used to estimate the distance from the camera to the ground surface.
  const cameraDistance =
    view.camera.raw.position.distanceTo(centerPoint) - polarRadius;

  // Store current distance for camera change detection
  gLastCameraDistance = cameraDistance;

  const visualThickness = 0.002; // How thick the line appears on screen
  const finalRadius = cameraDistance * visualThickness;

  // Set reasonable bounds to prevent extremely thin or thick tubes
  const minRadius = 10;
  const maxRadius = 100000;
  const clampedRadius = Math.max(minRadius, Math.min(maxRadius, finalRadius));

  // Use more segments for smoother geometry
  const tubularSegments = Math.max(64, curvePoints.length * 4); // More segments along the curve
  const radialSegments = 16; // More radial segments for rounder cross-section

  // Update the tube layer using layer.update()
  gPolylineLayer.update({
    tube: {
      points: curvePoints,
      tubularSegments: tubularSegments,
      radius: clampedRadius,
      radialSegments: radialSegments,
      tension: 0.5,
    },
  });

  const intBallRadius = clampedRadius * 2;
  gInterBall?.scale.set(intBallRadius, intBallRadius, intBallRadius);

  const mouseBallRadius = clampedRadius * 3;
  gMouseBall?.scale.set(mouseBallRadius, mouseBallRadius, mouseBallRadius);
};

const addCameraListener = (view: ThreeView) => {
  // Update tube thickness when camera moves
  view.camera.on("move", () => {
    if (!gPolylineLayer || !view.camera || gPolylinePoints.length === 0) return;

    const centerPoint = gPolylinePoints[Math.floor(gPolylinePoints.length / 2)];
    const currentDistance = view.camera.raw.position.distanceTo(centerPoint);

    // Only update if camera distance changed significantly (more than 10%)
    if (gLastCameraDistance > 0) {
      const distanceChange =
        Math.abs(currentDistance - gLastCameraDistance) / gLastCameraDistance;
      if (distanceChange > 0.1) {
        updatePolylineMesh(view, gPolylinePoints);
      }
    }

    updatePopup();
  });
};

const createPolylineMesh = (view: ThreeView) => {
  // Create initial points for the curve
  const points: XYZ[] = Array.from({ length: 2 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));

  gPolylineLayer = view.addLayer<TubeMeshLayer>({
    type: "mesh",
    tube: {
      points,
      tubularSegments: 64,
      radius: 1,
      radialSegments: 16,
      closed: false,
      tension: 0.5,
      color: 0x00ffff,
    },
  });
};

const testSampleTerrainHeight = (view: ThreeView) => {
  const onMouseMove = (event: MouseEvent) => {
    const rect = view.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pos = convertScreenPos(view, x, y);
    if (pos) {
      const lle = vector3ToGeodetic(pos);

      const height = view.sampleTerrainHeight(lle);

      gPaneParams.sampleLng = radianToDegree(lle.lng);
      gPaneParams.sampleLat = radianToDegree(lle.lat);
      gPaneParams.sampleTerrainHeight = height ?? 0;
      gFolderSample?.refresh();
    }
  };

  view.renderer.domElement.addEventListener("mousemove", onMouseMove);
};

const onRegisterChange = () => {
  if (gFujiUnregister) {
    gFujiUnregister();
    gFujiUnregister = null;
  }
  if (gKitaUnregister) {
    gKitaUnregister();
    gKitaUnregister = null;
  }

  if (gPaneParams.fujiRegistered) {
    gFujiUnregister = gView?.addTerrainHeightEvent(
      new LLE(degreeToRadian(gFujiPos[0]), degreeToRadian(gFujiPos[1]), 0),
      (height) => {
        gPaneParams.fujiHeight = height ?? 0;
        gFolderHeightEvent?.refresh();

        if (gModelFujiHandle?.ref?.raw) {
          // Reset position and rotation using update()
          gModelFujiHandle.update({
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          });

          const pos = geodeticToVector3(
            new LLE(
              degreeToRadian(gFujiPos[0]),
              degreeToRadian(gFujiPos[1]),
              gPaneParams.fujiHeight,
            ),
          );
          const transformMatrix = northUpEastToFixedFrame(pos);
          gModelFujiHandle.ref.raw.applyMatrix4(transformMatrix);
        }
      },
    );
  }

  if (gPaneParams.kitaRegistered) {
    gKitaUnregister = gView?.addTerrainHeightEvent(
      new LLE(degreeToRadian(gKitaPos[0]), degreeToRadian(gKitaPos[1]), 0),
      (height) => {
        gPaneParams.kitaHeight = height ?? 0;
        gFolderHeightEvent?.refresh();
      },
    );
  }
};

const testShowModelInfo = (view: ThreeView) => {
  view.on("pick", (event) => {
    if (!event) {
      gPickedPos = null;
      gPickedFeature = null;
      updatePopup();
      return;
    }

    const x = event.properties.get("_x");
    const y = event.properties.get("_y");
    const z = event.properties.get("_zmax");

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof z !== "number"
    ) {
      gPickedPos = null;
      gPickedFeature = null;
      updatePopup();
      return;
    }

    gPickedPos = geodeticToVector3(
      new LLE(degreeToRadian(y), degreeToRadian(x), z),
    );

    gPickedFeature = event;

    updatePopup();
  });
};

const updatePopup = () => {
  if (gView && gPickedFeature && gPickedPos) {
    const screenSize = gView.screenSize;
    const pixelRatio = gView.pixelRatio;

    const win = new NavaraWindow(screenSize.x, screenSize.y, pixelRatio);
    const screenPos = convertWorldToScreen(win, gView.camera.raw, gPickedPos);

    if (screenPos) {
      gPopup.updateMessages([
        `name: ${gPickedFeature.properties.get("gml:name") ?? "N/A"}`,
        `address: ${gPickedFeature.properties.get("bldg:address") ?? "N/A"}`,
        `class: ${gPickedFeature.properties.get("bldg:class") ?? "N/A"}`,
        `usage: ${gPickedFeature.properties.get("bldg:usage") ?? "N/A"}`,
      ]);
      gPopup.updatePosition(screenPos.x, screenPos.y);
      gPopup.show();
    } else {
      gPopup.hide();
    }
  } else {
    gPopup.hide();
  }
};

const onFovChange = () => {
  if (gView && gView.camera) {
    gView.camera.fov = gPaneParams.fov;
  }
};

const onNearChange = () => {
  if (gView && gView.camera) {
    gView.camera.near = gPaneParams.near;
  }
};

const onFarChange = () => {
  if (gView && gView.camera) {
    gView.camera.far = gPaneParams.far;
  }
};
