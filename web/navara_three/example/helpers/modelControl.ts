import ThreeView, {
  type LayerHandle,
  geodeticToVector3,
  vector3ToGeodetic,
  degreeToRadian,
  radianToDegree,
  geodeticSurfaceNormal,
  eastNorthUpToFixedFrame,
} from "@navara/three";
import type { GLTFModelLayer } from "@navara/three_default_layers";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";

export type ModelControlParams = {
  walkSpeed?: number; // Speed when walking forward/backward
  rotationSpeed?: number; // Speed of turning left/right
  cameraFollow?: boolean; // Whether to follow the model with the camera
  modelScale?: number; // Scale factor for the model
  allowUnderground?: boolean; // Whether the model is allowed to move below ground
  allowFly?: boolean; // Whether the model can move freely in 3D space

  dash?: number; // Dash speed multiplier
  height?: number; // height above the ground
};

export const controlGLTFModel = (
  view: ThreeView,
  modelLayer: LayerHandle<GLTFModelLayer>,
  params: ModelControlParams = {},
) => {
  const keys = new Set<string>();
  let dir = new Vector3(0, 0, 0);
  let currentState: "Idle" | "Walk" | "Run" = "Idle";
  let hasMovement = false;

  params.cameraFollow = params.cameraFollow ?? true;
  if (params.cameraFollow) {
    const curPos = modelLayer.ref.getWorldPosition();
    if (curPos) {
      const curLLE = vector3ToGeodetic(curPos);
      view.cameraFollow(true, {
        lat: radianToDegree(curLLE.lat),
        lng: radianToDegree(curLLE.lng),
        height: curLLE.height + (params.modelScale ?? 1),
      });
    }
  }

  const handleKey = (keyCode: string, down: boolean) => {
    collectKey(keyCode, down, keys);

    dir.set(0, 0, 0);
    if (keys.has("w")) dir.y += 1; // Move forward (camera's ground-projected forward)
    if (keys.has("s")) dir.y -= 1; // Move backward
    if (keys.has("a")) dir.x -= 1; // Move left (perpendicular to forward, on ground)
    if (keys.has("d")) dir.x += 1; // Move right
    if (keys.has("up")) dir.z += 1; // Move up along surface normal
    if (keys.has("down")) dir.z -= 1; // Move down along surface normal

    params.dash = keys.has("dash") ? 2 : 1; // Dash multiplier

    dir = dir.normalize();

    hasMovement = dir.x !== 0 || dir.y !== 0 || dir.z !== 0;

    // Update model animation based on movement and dash state
    let targetState: "Idle" | "Walk" | "Run";
    if (!hasMovement) {
      targetState = "Idle";
    } else if (params.dash && params.dash > 1) {
      targetState = "Run";
    } else {
      targetState = "Walk";
    }

    // Transition to new state if changed
    if (targetState !== currentState) {
      modelLayer.ref.crossFadeAnimation(currentState, targetState, 0.3);
      currentState = targetState;
    }
  };

  document.addEventListener("keydown", (event) => {
    handleKey(event.code, true);
  });

  document.addEventListener("keyup", (event) => {
    handleKey(event.code, false);
  });

  let lastTime = performance.now();
  const animFunc = (currentTime: number) => {
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    if (hasMovement) {
      updateModelTransform(view, modelLayer, dir, deltaTime, params);

      const curPos = modelLayer.ref.getWorldPosition();
      if (curPos) {
        updateCameraFollow(view, curPos, params);
      }
    }

    requestAnimationFrame(animFunc);
  };
  requestAnimationFrame(animFunc);
};

const collectKey = (keyCode: string, down: boolean, keys: Set<string>) => {
  switch (keyCode) {
    case "KeyW":
      if (down) {
        keys.add("w");
      } else {
        keys.delete("w");
      }
      break;
    case "KeyA":
      if (down) {
        keys.add("a");
      } else {
        keys.delete("a");
      }
      break;

    case "KeyS":
      if (down) {
        keys.add("s");
      } else {
        keys.delete("s");
      }
      break;
    case "KeyD":
      if (down) {
        keys.add("d");
      } else {
        keys.delete("d");
      }
      break;
    case "ShiftLeft":
      if (down) {
        keys.add("dash");
      } else {
        keys.delete("dash");
      }
      break;
    case "Space":
      if (down) {
        keys.add("up");
      } else {
        keys.delete("up");
      }
      break;
    case "ControlLeft":
      if (down) {
        keys.add("down");
      } else {
        keys.delete("down");
      }
      break;
    default:
      break;
  }
};

const updateModelTransform = (
  view: ThreeView,
  modelLayer: LayerHandle<GLTFModelLayer>,
  dir: Vector3,
  deltaTime: number,
  params: ModelControlParams,
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
  const surfaceNormal = geodeticSurfaceNormal(currentLLE);

  let height = currentLLE.height + dir.z * (params.walkSpeed ?? 1) * deltaTime;

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
    currentYaw += degreeToRadian(params.rotationSpeed ?? 2);
  } else if (dir.x < 0) {
    // Turn left
    currentYaw -= degreeToRadian(params.rotationSpeed ?? 2);
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
      (params.walkSpeed ?? 1) *
        (params.dash ?? 1) *
        deltaTime *
        Math.sign(dir.y),
    );
  }

  // Convert quaternion back to euler for update
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight({
    lat: curLLE.lat,
    lng: curLLE.lng,
    height: 0,
  });

  if (params.allowFly) {
    if (!params.allowUnderground) {
      height = Math.max(
        height,
        terrainHeight !== undefined ? terrainHeight : 0,
      ); // Prevent negative height
    }
  } else {
    height = terrainHeight !== undefined ? terrainHeight : 0;
  }

  const curTerrainPos = geodeticToVector3({
    lat: curLLE.lat,
    lng: curLLE.lng,
    height,
  });

  modelLayer.update({
    position: { x: curTerrainPos.x, y: curTerrainPos.y, z: curTerrainPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  return currentYaw;
};

/**
 * Update camera position to follow the model
 */
const updateCameraFollow = (
  view: ThreeView,
  curPos: Vector3,
  params: ModelControlParams,
) => {
  if (!params.cameraFollow) {
    return;
  }

  const curLLE = vector3ToGeodetic(curPos);

  view.cameraFollow(params.cameraFollow, {
    lat: radianToDegree(curLLE.lat),
    lng: radianToDegree(curLLE.lng),
    height: curLLE.height + (params.modelScale ?? 1), // Add modelScale to keep camera looking at model center height
  });
};
