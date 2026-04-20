import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type MeshHandle,
  type PickedFeature,
  type Nullable,
  type XYZ,
  type MapMouseEvent,
  type Window,
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
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
  EllipsoidGeodesic,
  Color,
} from "@navara/three";
import type {
  SphereMeshDesc,
  TubeMeshDesc,
  CylinderMeshDesc,
  GLTFModelDesc,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Mesh, Vector2, Vector3, Object3D, Group, ArrowHelper } from "three";
import { Pane, FolderApi } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

import { FloatingDialog } from "./dialog";

const gPaneParams = {
  convertScreenToWorld: false,
  extrudeCylinder: false,
  moveDistance: 0,
  transform: "northUpEast",

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

let gModelNormalHandle: Nullable<MeshHandle<GLTFModelDesc>> = undefined;
let gModelFujiHandle: Nullable<MeshHandle<GLTFModelDesc>> = undefined;
let gPolylineLayer: Nullable<MeshHandle<TubeMeshDesc>> = undefined;
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

export type CustomDeclarations = DefaultDeclarations;

export const run = async (
  view: ThreeView<CustomDeclarations>,
  canvas: HTMLCanvasElement,
) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  plugin.addDefaultPhotorealScene();

  gView = view;

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

  view.on("mousedown", (event: MapMouseEvent) => {
    console.log("3D Position:", event.map);
    console.log("Screen Position:", event.clientX, event.clientY);
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {},
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
    },
  });

  view.addMesh({
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
  testScreenToWorld(view, canvas);

  // extrude a cylinder from the elipsoid surface
  testRayPlane(view, canvas);

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

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.openstreetmap,
    TILES_3D_DATASETS.plateauChiyoda,
    LOCAL_DATASETS.steelDrumGLTF,
  ]);
};

const addRunningObject = (view: ThreeView<CustomDeclarations>) => {
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

    const pos = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: 1000000,
    });
    sphere.position.set(pos.x, pos.y, pos.z);

    view.forceUpdate();
    requestAnimationFrame(animateFunc);
  };
  animateFunc();
};

const testScreenToWorld = (
  view: ThreeView<CustomDeclarations>,
  canvas: HTMLCanvasElement,
) => {
  const onMouseMove = (event: MouseEvent) => {
    if (!gPaneParams.convertScreenToWorld) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pos = view.pickTerrainPosition(x, y);

    if (gMouseBall && pos) {
      gMouseBall.position.set(pos.x, pos.y, pos.z);
      view.forceUpdate();
    }
  };

  canvas.addEventListener("mousemove", onMouseMove);
};

const placeOneBall = (
  view: ThreeView<CustomDeclarations>,
  pos: Vector3 | undefined,
  color: number,
): Mesh | undefined => {
  if (pos) {
    const sphereLayer = view.addMesh<SphereMeshDesc>({
      sphere: {
        radius: 1,
        color: new Color().setHex(color),
        emissiveColor: new Color().setHex(0x072534),
      },
      position: { x: pos.x, y: pos.y, z: pos.z },
    });

    // sphereLayer is a MeshHandle for mesh descriptors
    return sphereLayer.ref.raw;
  }
};

const addTestModelForNormal = (view: ThreeView<CustomDeclarations>) => {
  const pos = geodeticToVector3({
    lat: degreeToRadian(43.0618),
    lng: degreeToRadian(141.3545),
    height: 0,
  });
  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(43.0618),
    lng: degreeToRadian(141.3545),
    height: 0,
  });

  // Add GLTF model using GLTFModelDesc with URL
  const modelLayer = view.addMesh<GLTFModelDesc>({
    gltfModel: {
      url: LOCAL_DATASETS.steelDrumGLTF.url,
    },
    scale: { x: 200000, y: 200000, z: 200000 },
    position: { x: pos.x, y: pos.y, z: pos.z },
  });

  // Add arrow helper
  view.addMesh({
    arrowHelper: {
      direction: normal,
      origin: pos,
      length: 5000000,
      color: new Color().setStyle("#ffffff"),
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

const addTestModelForTerrainHeight = (view: ThreeView<CustomDeclarations>) => {
  const pos = geodeticToVector3({
    lat: degreeToRadian(gFujiPos[0]),
    lng: degreeToRadian(gFujiPos[1]),
    height: 0,
  });

  const transformMatrix = northUpEastToFixedFrame(pos);

  // Add the model using GLTFModelDesc with URL
  const modelLayer = view.addMesh<GLTFModelDesc>({
    gltfModel: {
      url: LOCAL_DATASETS.steelDrumGLTF.url,
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
    scale: { x: 200000, y: 200000, z: 200000 },
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
    const currentPos = gModelNormalHandle.ref.getWorldPosition();
    currentPos.add(moveOffset);
    gModelNormalHandle.update({ position: currentPos });
  }
};

const testRayPlane = (
  view: ThreeView<CustomDeclarations>,
  canvas: HTMLCanvasElement,
) => {
  let center: Vector3 | undefined = undefined;
  let radius: number | undefined = undefined;
  let height: number | undefined = undefined;
  let normal: Vector3 | undefined = undefined;
  let btmDist: number | undefined = undefined;
  let cylinder: Mesh | undefined = undefined;
  let bMouseMoved = false;

  const onMouseDown = (_e: MapMouseEvent) => {
    bMouseMoved = false;
  };
  const onMouseMove = (event: MapMouseEvent) => {
    bMouseMoved = true;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const screenSize = view.screenSize;
    const pixelRatio = view.pixelRatio;

    if (center && normal && !radius) {
      const win: Window = {
        width: screenSize.x,
        height: screenSize.y,
        pixelRatio: pixelRatio,
      };
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
      const win: Window = {
        width: screenSize.x,
        height: screenSize.y,
        pixelRatio: pixelRatio,
      };
      const ray = getPickRay(win, view.camera.raw, new Vector2(x, y));
      const rayDir = ray.direction.clone();
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
  const onMouseUp = (event: MapMouseEvent) => {
    if (bMouseMoved || !gPaneParams.extrudeCylinder) {
      return;
    }

    const mapPos = event.map;
    const pos = mapPos ? new Vector3(mapPos.x, mapPos.y, mapPos.z) : null;

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

  view.on("mousedown", onMouseDown);
  view.on("mousemove", onMouseMove);
  view.on("mouseup", onMouseUp);
};

const makeCylinder = (
  view: ThreeView<CustomDeclarations>,
  center: Vector3,
): Mesh | undefined => {
  const cylinderLayer = view.addMesh<CylinderMeshDesc>({
    cylinder: {
      radiusTop: 1,
      radiusBottom: 1,
      height: 1,
      radialSegments: 32,
      heightSegments: 1,
      openEnded: false,
      thetaStart: 0,
      thetaLength: Math.PI * 2,
      color: new Color().setStyle("#ffff00"),
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
  const start = {
    lat: degreeToRadian(gPaneParams.latStart),
    lng: degreeToRadian(gPaneParams.lngStart),
    height: 0,
  };
  const end = {
    lat: degreeToRadian(gPaneParams.latEnd),
    lng: degreeToRadian(gPaneParams.lngEnd),
    height: 0,
  };

  const geodesic = new EllipsoidGeodesic(start, end);
  gPaneParams.distance = geodesic.distance;

  gFolderDist?.refresh();

  const points = geodesic.interpolatePoints(gPaneParams.distance * 0.01);

  // Update polyline mesh
  if (gPolylineLayer) {
    const curvePoints: XYZ[] = [];
    for (const point of points) {
      const pos = geodeticToVector3({
        lat: point.lat,
        lng: point.lng,
        height: 1000,
      });
      curvePoints.push(pos);
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
      const interPoint = geodesic.interpolateDistance(interDist);
      const pos = geodeticToVector3({
        lat: interPoint.lat,
        lng: interPoint.lng,
        height: 1000,
      });
      gInterBall?.position.set(pos.x, pos.y, pos.z);
    }
  }

  geodesic.dispose();
};

const updatePolylineMesh = (
  view: ThreeView<CustomDeclarations>,
  curvePoints: XYZ[],
) => {
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

const addCameraListener = (view: ThreeView<CustomDeclarations>) => {
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

const createPolylineMesh = (view: ThreeView<CustomDeclarations>) => {
  // Create initial points for the curve
  const points: XYZ[] = Array.from({ length: 2 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));

  gPolylineLayer = view.addMesh<TubeMeshDesc>({
    tube: {
      points,
      tubularSegments: 64,
      radius: 1,
      radialSegments: 16,
      closed: false,
      tension: 0.5,
      color: new Color().setStyle("#00ffff"),
    },
  });
};

const testSampleTerrainHeight = (view: ThreeView<CustomDeclarations>) => {
  const onMouseMove = (event: MapMouseEvent) => {
    const mapPos = event.map;

    if (mapPos) {
      const pos = new Vector3(mapPos.x, mapPos.y, mapPos.z);
      const lle = vector3ToGeodetic(pos);

      const height = view.sampleTerrainHeight(lle);

      gPaneParams.sampleLng = radianToDegree(lle.lng);
      gPaneParams.sampleLat = radianToDegree(lle.lat);
      gPaneParams.sampleTerrainHeight = height ?? 0;
      gFolderSample?.refresh();
    }
  };

  view.on("mousemove", onMouseMove);
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
    gFujiUnregister = gView?.observeTerrainHeightAt(
      { lat: degreeToRadian(gFujiPos[0]), lng: degreeToRadian(gFujiPos[1]) },
      (height) => {
        gPaneParams.fujiHeight = height ?? 0;
        gFolderHeightEvent?.refresh();

        if (gModelFujiHandle?.ref?.raw) {
          // Reset position and rotation using update()
          gModelFujiHandle.update({
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          });

          const pos = geodeticToVector3({
            lat: degreeToRadian(gFujiPos[0]),
            lng: degreeToRadian(gFujiPos[1]),
            height: gPaneParams.fujiHeight,
          });
          const transformMatrix = northUpEastToFixedFrame(pos);
          gModelFujiHandle.ref.raw.applyMatrix4(transformMatrix);
        }
      },
    );
  }

  if (gPaneParams.kitaRegistered) {
    gKitaUnregister = gView?.observeTerrainHeightAt(
      { lat: degreeToRadian(gKitaPos[0]), lng: degreeToRadian(gKitaPos[1]) },
      (height) => {
        gPaneParams.kitaHeight = height ?? 0;
        gFolderHeightEvent?.refresh();
      },
    );
  }
};

const testShowModelInfo = (view: ThreeView<CustomDeclarations>) => {
  view.on("pick", (info) => {
    if (!info) {
      gPickedPos = null;
      gPickedFeature = null;
      updatePopup();
      return;
    }

    const x = info.properties?.["_x"];
    const y = info.properties?.["_y"];
    const z = info.properties?.["_zmax"];

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

    gPickedPos = geodeticToVector3({
      lat: degreeToRadian(y),
      lng: degreeToRadian(x),
      height: z,
    });

    gPickedFeature = info;

    updatePopup();
  });
};

const updatePopup = () => {
  if (gView && gPickedFeature && gPickedPos) {
    const screenSize = gView.screenSize;
    const pixelRatio = gView.pixelRatio;

    const win: Window = {
      width: screenSize.x,
      height: screenSize.y,
      pixelRatio: pixelRatio,
    };
    const screenPos = convertWorldToScreen(win, gView.camera.raw, gPickedPos);

    if (screenPos) {
      gPopup.updateMessages([
        `name: ${gPickedFeature.properties?.["gml:name"] ?? "N/A"}`,
        `address: ${gPickedFeature.properties?.["bldg:address"] ?? "N/A"}`,
        `class: ${gPickedFeature.properties?.["bldg:class"] ?? "N/A"}`,
        `usage: ${gPickedFeature.properties?.["bldg:usage"] ?? "N/A"}`,
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
