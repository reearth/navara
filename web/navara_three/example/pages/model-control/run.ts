import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
  type GLTFModelLayer,
  type LayerHandle,
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  geodeticSurfaceNormal,
  LLE,
  Color,
} from "@navara/three";
import { eastNorthUpToFixedFrame } from "@navara/three_api";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  LOCAL_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";

const params = {
  runSpeed: 5,
  rotationSpeed: 1.5,
  modelScale: 1,
  cameraFollow: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.toneMappingExposure = 3;
  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.addLayer({
    type: "effect",
    smaa: {},
  });

  view.addLayer({
    type: "light",
    sun: {
      intensity: 1,
    },
  });
  view.addLayer({
    type: "mesh",
    sky: {},
  });

  view.addLayer({
    type: "light",
    ambient: {
      intensity: 0.1,
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.openstreetmap.url,
    },
    rasterTile: {
      maxZoom: 23,
    },
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
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
      castShadow: true,
      receiveShadow: true,
      height: -50,
    },
  });

  view.camera.options = {
    autoAdjustNearFar: true,
  };

  const pane = new Pane();
  addDateControl(view, pane);

  showAttributions([
    TERRAIN_DATASETS.mapterhorn,
    TILE_DATASETS.openstreetmap,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);

  const startLLE = [35.69127684, 139.75865163, 7];

  const startPos = geodeticToVector3(
    new LLE(
      degreeToRadian(startLLE[0]),
      degreeToRadian(startLLE[1]),
      startLLE[2],
    ),
  );

  const normal = geodeticSurfaceNormal(
    new LLE(
      degreeToRadian(startLLE[0]),
      degreeToRadian(startLLE[1]),
      startLLE[2],
    ),
  );
  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model at Mount Fuji summit
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: LOCAL_DATASETS.soldierGLTF.url,
      animationEnabled: true,
      animationActiveClip: "Idle",
      animationSpeed: 1.0,
      animationLoop: true,
      animationAutoPlay: true,
      animationCrossfadeDuration: 0.3,
      useRTE: true,
    },
    scale: { x: params.modelScale, y: params.modelScale, z: params.modelScale },
    position: { x: startPos.x, y: startPos.y, z: startPos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  view.lookAt(
    new LLE(startLLE[0], startLLE[1], startLLE[2]),
    new Vector3(10, 0, 5),
  );

  initKeyboardControls(view, modelLayer);

  pane.addBinding(params, "runSpeed", { min: 1, max: 1000 });
  pane.addBinding(params, "rotationSpeed", { min: 0.1, max: 5 });
  pane
    .addBinding(params, "modelScale", { min: 1, max: 100 })
    .on("change", () => {
      modelLayer.update({
        scale: {
          x: params.modelScale,
          y: params.modelScale,
          z: params.modelScale,
        },
      });
    });

  pane.addBinding(params, "cameraFollow").on("change", () => {
    if (!params.cameraFollow) {
      view.cameraFollow(false);
    }
  });
};

const initKeyboardControls = (
  view: ThreeView,
  modelLayer: LayerHandle<GLTFModelLayer>,
) => {
  const keys = new Set<string>();
  let dir = new Vector3(0, 0, 0);
  let isMoving = false;
  let hasMovement = false;

  const handleKey = (key: string, down: boolean) => {
    switch (key) {
      case "w":
      case "W":
        if (down) {
          keys.add("w");
        } else {
          keys.delete("w");
        }
        break;
      case "a":
      case "A":
        if (down) {
          keys.add("a");
        } else {
          keys.delete("a");
        }
        break;
      case "s":
      case "S":
        if (down) {
          keys.add("s");
        } else {
          keys.delete("s");
        }
        break;
      case "d":
      case "D":
        if (down) {
          keys.add("d");
        } else {
          keys.delete("d");
        }
        break;
    }

    dir.set(0, 0, 0);
    if (keys.has("w")) dir.y += 1; // Move forward (camera's ground-projected forward)
    if (keys.has("s")) dir.y -= 1; // Move backward
    if (keys.has("a")) dir.x -= 1; // Move left (perpendicular to forward, on ground)
    if (keys.has("d")) dir.x += 1; // Move right

    dir = dir.normalize();

    hasMovement = dir.x !== 0 || dir.y !== 0 || dir.z !== 0;

    // Update model animation based on movement
    if (hasMovement && !isMoving) {
      // Start running
      modelLayer.ref.crossFadeAnimation("Idle", "Run", 0.3);
      isMoving = true;
    } else if (!hasMovement && isMoving) {
      // Stop running
      modelLayer.ref.crossFadeAnimation("Run", "Idle", 0.3);
      isMoving = false;
    }
  };

  document.addEventListener("keydown", (event) => {
    handleKey(event.key, true);
  });

  document.addEventListener("keyup", (event) => {
    handleKey(event.key, false);
  });

  let lastTime = performance.now();
  const animFunc = (currentTime: number) => {
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    if (hasMovement) {
      updateModelTransform(view, modelLayer, dir, deltaTime);

      const curPos = modelLayer.ref.getWorldPosition();
      if (curPos) {
        updateCameraFollow(view, curPos);
      }
    }

    requestAnimationFrame(animFunc);
  };
  requestAnimationFrame(animFunc);
};

const updateModelTransform = (
  view: ThreeView,
  modelLayer: LayerHandle<GLTFModelLayer>,
  dir: Vector3,
  deltaTime: number,
) => {
  const modelObject = modelLayer.ref.raw;
  if (!modelObject) {
    return;
  }

  const curPos = modelLayer.ref.getWorldPosition();
  if (!curPos) {
    return;
  }

  // Get current position in geodetic coordinates to calculate surface normal
  const currentLLE = vector3ToGeodetic(curPos);
  const surfaceNormal = geodeticSurfaceNormal(
    new LLE(currentLLE.lat, currentLLE.lng, currentLLE.height),
  );

  // Build rotation based on ENU (East-North-Up) frame using WASM API
  const enuMatrix = eastNorthUpToFixedFrame(curPos);
  const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
  const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

  // Extract current yaw from model's quaternion
  // Get model's forward direction in world space (model's local -Z axis)
  const modelForward = new Vector3(0, 0, -1).applyQuaternion(
    modelObject.quaternion,
  );

  // Project forward direction onto ENU tangent plane
  const forwardProjected = modelForward
    .clone()
    .sub(surfaceNormal.clone().multiplyScalar(modelForward.dot(surfaceNormal)))
    .normalize();

  // Calculate current yaw (angle from north)
  const eastComponent = forwardProjected.dot(east);
  const northComponent = forwardProjected.dot(north);
  let currentYaw = Math.atan2(eastComponent, northComponent);

  // Apply incremental rotation based on input
  if (dir.x > 0) {
    // Turn right
    currentYaw += degreeToRadian(params.rotationSpeed);
  } else if (dir.x < 0) {
    // Turn left
    currentYaw -= degreeToRadian(params.rotationSpeed);
  }

  // Calculate new forward direction based on updated yaw
  const forwardInENU = new Vector3(
    Math.sin(currentYaw), // East component
    Math.cos(currentYaw), // North component
    0,
  );

  // Convert to world space forward direction
  const worldForward = east
    .clone()
    .multiplyScalar(forwardInENU.x)
    .add(north.clone().multiplyScalar(forwardInENU.y));

  // Build quaternion from forward and up directions
  const worldRight = worldForward.clone().cross(surfaceNormal).normalize();
  const finalQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(
      worldRight,
      surfaceNormal,
      worldForward.clone().negate(),
    ),
  );

  // Move only if pressing forward or backward
  if (dir.y !== 0) {
    // Move along model's forward direction
    // Move forward (dir.y > 0) or backward (dir.y < 0)
    curPos.addScaledVector(
      worldForward,
      params.runSpeed * deltaTime * Math.sign(dir.y),
    );
  }

  // Convert quaternion back to euler for update
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight(
    new LLE(curLLE.lat, curLLE.lng, 0),
  );

  // Convert to ECEF coordinates (place on terrain surface)
  // If terrain height is not available yet, keep current height
  const finalHeight =
    terrainHeight !== undefined ? terrainHeight : curLLE.height;
  const curTerrainPos = geodeticToVector3(
    new LLE(curLLE.lat, curLLE.lng, finalHeight),
  );

  modelLayer.update({
    position: { x: curTerrainPos.x, y: curTerrainPos.y, z: curTerrainPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  return currentYaw;
};

/**
 * Update camera position to follow the model
 */
const updateCameraFollow = (view: ThreeView, curPos: Vector3) => {
  if (!params.cameraFollow) {
    return;
  }

  const curLLE = vector3ToGeodetic(curPos);

  view.cameraFollow(
    params.cameraFollow,
    new LLE(
      (curLLE.lat * 180) / Math.PI,
      (curLLE.lng * 180) / Math.PI,
      curLLE.height + params.modelScale, // Add modelScale to keep camera looking at model center height
    ),
  );
};
