---
title: Interior Explore
description: How to explore the interior of 3D buildings with model controls
sidebar:
  order: 8
---

![Result](@assets/tutorial/model-animation.png)

Learn how to explore the interior of 3D Tiles buildings while controlling a model.

**What you will learn in this tutorial:**
- Loading 3D Tiles building models
- Placing a GLTF/GLB character model on the globe
- Moving and rotating the model with keyboard input
- Making the camera follow the model
- Freely moving inside buildings (underground and flight mode)

## Setting Up the Basic Scene

First, build a scene for building exploration. Create a `ThreeView` with shadow and background color settings.

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
  eastNorthUpToFixedFrame,
  JAPAN_GSI_ELEVATION_DECODER,
  type GLTFModelLayer,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
view.addPlugin(plugin);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

// Set up a photorealistic scene in one call
const layers = plugin.addDefaultPhotorealLayers();

// Enable sun shadows
layers.sun.update({
  sun: { castShadow: true },
});
```

## Adding Terrain and Map Tiles

Add terrain and satellite imagery tiles for the exploration area.

```typescript
// Terrain layer
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false, // Disable skirt when exploring underground models
  },
});

// Satellite imagery tiles
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});
```

## Loading 3D Tiles Building Models

Load building models in Cesium 3D Tiles format, such as those from PLATEAU. Enable shadow settings for exploring building interiors.

```typescript
// 3D Tiles building model
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35, // Ellipsoidal height adjustment
  },
});
```

:::note[About Ellipsoidal Height Adjustment]
3D Tiles models may be placed based on ellipsoidal height (WGS84). In Japan, there is a difference between ellipsoidal height and geoid height, so adjustment using the `height` property may be necessary.
:::

## Placing a Character Model

Place a GLTF model as an exploration character (avatar). This tutorial uses the Soldier.glb model included in the official Three.js samples.

:::note[Preparing Model Data]
Soldier.glb is external data provided in the official Three.js repository. Follow these steps to download it:

1. Download Soldier.glb from the [Three.js GitHub repository](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/Soldier.glb)
2. Place it in the `public/glTF/Soldier/` directory of your project

This model contains Idle, Walk, and Run animation clips, making it suitable for implementing model movement controls. If you use a different animated GLTF model, change the animation clip names accordingly.
:::

```typescript
// Starting position (latitude, longitude, altitude)
const startLat = 35.6341630282;
const startLng = 139.7420527162;
const startHeight = 23.0;

// Convert geographic coordinates to ECEF coordinates
const startPos = geodeticToVector3({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// Get surface normal to make the model stand upright
const normal = geodeticSurfaceNormal({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// Get east and north directions from ENU coordinate system
const enuMatrix = eastNorthUpToFixedFrame(startPos);
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// Set initial orientation
const initialYaw = Math.PI * 1.6;
const worldForward = east.clone().multiplyScalar(Math.sin(initialYaw))
                    .add(north.clone().multiplyScalar(Math.cos(initialYaw)));
const worldRight = worldForward.clone().cross(normal).normalize();

// Generate quaternion from rotation matrix
const quaternion = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(worldRight, normal, worldForward.clone().negate())
);
const euler = new Euler().setFromQuaternion(quaternion);

// Add character model
const modelLayer = view.addMesh<GLTFModelLayer>({
  gltfModel: {
    // Credit:
    // - Soldier.glb - Three.js examples
    //   https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
    url: "/glTF/Soldier/Soldier.glb",
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
    animationCrossfadeDuration: 0.3,
  },
  position: { x: startPos.x, y: startPos.y, z: startPos.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});

// Initial camera position
const cameraDistance = 8;
const cameraHeight = 1;
const cameraOffset = new Vector3(
  -Math.sin(initialYaw) * cameraDistance,
  -Math.cos(initialYaw) * cameraDistance,
  cameraHeight
);
view.lookAt(
  { lat: startLat, lng: startLng, height: startHeight + 1 },
  cameraOffset,
);
```

## Controlling the Model with Keyboard Input

Implement model control using the keyboard. Use the ENU (East-North-Up) coordinate system for intuitive movement.

```typescript
import { vector3ToGeodetic, radianToDegree } from "@navara/three";
import { Matrix4 } from "three";

// Key state management
const keys = new Set<string>();
let currentState: "Idle" | "Walk" | "Run" = "Idle";

// Movement parameters
const walkSpeed = 5;      // m/s
const rotationSpeed = 3;  // degrees/frame
let dashMultiplier = 1;

// Key input handler
document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": keys.add("forward"); break;
    case "KeyS": keys.add("backward"); break;
    case "KeyA": keys.add("left"); break;
    case "KeyD": keys.add("right"); break;
    case "Space": keys.add("up"); break;
    case "ControlLeft": keys.add("down"); break;
    case "ShiftLeft": dashMultiplier = 2; break;
  }
  updateAnimation();
});

document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": keys.delete("forward"); break;
    case "KeyS": keys.delete("backward"); break;
    case "KeyA": keys.delete("left"); break;
    case "KeyD": keys.delete("right"); break;
    case "Space": keys.delete("up"); break;
    case "ControlLeft": keys.delete("down"); break;
    case "ShiftLeft": dashMultiplier = 1; break;
  }
  updateAnimation();
});

// Switch animation state
function updateAnimation() {
  const hasMovement = keys.size > 0;
  let targetState: "Idle" | "Walk" | "Run";

  if (!hasMovement) {
    targetState = "Idle";
  } else if (dashMultiplier > 1) {
    targetState = "Run";
  } else {
    targetState = "Walk";
  }

  if (targetState !== currentState) {
    modelLayer.ref.crossFadeAnimation(currentState, targetState, 0.3);
    currentState = targetState;
  }
}
```

**Key Bindings**
| Key          | Action              |
| ------------ | ------------------- |
| W / S        | Move forward / back |
| A / D        | Turn left / right   |
| Shift        | Dash (accelerate)   |
| Space / Ctrl | Ascend / descend    |

## Implementing Model Movement

Move the model using the ENU coordinate system. Allow underground movement and flight for exploring building interiors.

```typescript
// Movement options
const allowFly = true;        // Allow vertical movement
const allowUnderground = true; // Allow underground movement

let lastTime = performance.now();

function tick(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const modelObject = modelLayer.ref.raw;
  const curPos = modelLayer.ref.getWorldPosition();
  if (!modelObject || !curPos) {
    requestAnimationFrame(tick);
    return;
  }

  // Calculate movement direction
  let dirX = 0, dirY = 0, dirZ = 0;
  if (keys.has("forward")) dirY += 1;
  if (keys.has("backward")) dirY -= 1;
  if (keys.has("left")) dirX -= 1;
  if (keys.has("right")) dirX += 1;
  if (keys.has("up")) dirZ += 1;
  if (keys.has("down")) dirZ -= 1;

  // Get ENU coordinate system
  const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
  const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
  const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

  // Get current geographic coordinates and surface normal
  const currentLLE = vector3ToGeodetic(curPos);
  const surfaceNormal = geodeticSurfaceNormal({
    lat: currentLLE.lat,
    lng: currentLLE.lng,
    height: currentLLE.height,
  });

  // Extract current yaw angle
  const modelForward = new Vector3(0, 0, -1).applyQuaternion(modelObject.quaternion);
  const forwardProjected = modelForward
    .clone()
    .sub(surfaceNormal.clone().multiplyScalar(modelForward.dot(surfaceNormal)))
    .normalize();
  let currentYaw = Math.atan2(forwardProjected.dot(east), forwardProjected.dot(north));

  // Turning
  if (dirX !== 0) {
    currentYaw += degreeToRadian(rotationSpeed * dirX);
  }

  // Calculate new forward vector
  const worldForward = east
    .clone()
    .multiplyScalar(Math.sin(currentYaw))
    .add(north.clone().multiplyScalar(Math.cos(currentYaw)));

  // Calculate rotation
  const worldRight = worldForward.clone().cross(surfaceNormal).normalize();
  const finalQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(worldRight, surfaceNormal, worldForward.clone().negate())
  );
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  // Forward/backward movement
  if (dirY !== 0) {
    curPos.addScaledVector(worldForward, walkSpeed * dashMultiplier * deltaTime * dirY);
  }

  // Altitude calculation
  let height = currentLLE.height + dirZ * walkSpeed * deltaTime;
  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight({ lat: curLLE.lat, lng: curLLE.lng, height: 0 }) ?? 0;

  // Flight and underground movement control
  if (allowFly) {
    if (!allowUnderground) {
      height = Math.max(height, terrainHeight);
    }
  } else {
    height = terrainHeight;
  }

  // Calculate and update final position
  const finalPos = geodeticToVector3({ lat: curLLE.lat, lng: curLLE.lng, height });

  modelLayer.update({
    position: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  // Camera follow
  view.cameraFollow(
    true,
    { lat: radianToDegree(curLLE.lat), lng: radianToDegree(curLLE.lng), height: height + 1 }
  );

  requestAnimationFrame(tick);
}

// Start after model loading completes
modelLayer.ref.on("load", () => {
  requestAnimationFrame(tick);
});
```

:::note[What is the ENU Coordinate System?]
The ENU (East-North-Up) coordinate system is a local coordinate system based on a point on the Earth's surface.

- **East**: East direction (X axis)
- **North**: North direction (Y axis)
- **Up**: Zenith direction (Z axis)

Using this coordinate system enables intuitive "forward" and "left/right" movement even on the Earth's curved surface.
:::

:::tip[Tips for Exploring Building Interiors]
- Setting `allowUnderground: true` allows movement below ground level (such as underground floors of buildings)
- Setting `allowFly: true` allows free vertical movement with the Space/Ctrl keys
- To freely move the camera, release following with `view.cameraFollow(false)`
:::

## Complete Example

Below is a complete example of exploring a building interior with model controls.

```typescript
import ThreeView, {
  Color,
  geodeticToVector3,
  geodeticSurfaceNormal,
  degreeToRadian,
  vector3ToGeodetic,
  radianToDegree,
  eastNorthUpToFixedFrame,
  JAPAN_GSI_ELEVATION_DECODER,
  type GLTFModelLayer,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
view.addPlugin(plugin);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

// Set up a photorealistic scene in one call
const layers = plugin.addDefaultPhotorealLayers();
layers.sun.update({ sun: { castShadow: true } });

// Terrain layer
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false, // Disable skirt when exploring underground models
  },
});

// Satellite imagery tiles
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});

// 3D Tiles building model
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35,
  },
});

// Starting position
const startLat = 35.6341630282;
const startLng = 139.7420527162;
const startHeight = 23.0;

// Character model
const startPos = geodeticToVector3({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});
const normal = geodeticSurfaceNormal({
  lat: degreeToRadian(startLat),
  lng: degreeToRadian(startLng),
  height: startHeight,
});

// Get east and north directions from ENU coordinate system
const enuMatrix = eastNorthUpToFixedFrame(startPos);
const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

// Set initial orientation
const initialYaw = Math.PI * 1.6;
const worldForward = east.clone().multiplyScalar(Math.sin(initialYaw))
                    .add(north.clone().multiplyScalar(Math.cos(initialYaw)));
const worldRight = worldForward.clone().cross(normal).normalize();

// Generate quaternion from rotation matrix
const quaternion = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(worldRight, normal, worldForward.clone().negate())
);
const euler = new Euler().setFromQuaternion(quaternion);

const modelLayer = view.addMesh<GLTFModelLayer>({
  gltfModel: {
    // Credit:
    // - Soldier.glb - Three.js examples
    //   https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
    url: "/glTF/Soldier/Soldier.glb",
    animationEnabled: true,
    animationActiveClip: "Idle",
    animationSpeed: 1.0,
    animationLoop: true,
    animationAutoPlay: true,
    animationCrossfadeDuration: 0.3,
  },
  position: { x: startPos.x, y: startPos.y, z: startPos.z },
  rotation: { x: euler.x, y: euler.y, z: euler.z },
});

const cameraDistance = 8;
const cameraHeight = 1;
const cameraOffset = new Vector3(
  -Math.sin(initialYaw) * cameraDistance,
  -Math.cos(initialYaw) * cameraDistance,
  cameraHeight
);
view.lookAt(
  { lat: startLat, lng: startLng, height: startHeight + 1 },
  cameraOffset,
);

// Movement parameters
const keys = new Set<string>();
let currentState: "Idle" | "Walk" | "Run" = "Idle";
const walkSpeed = 5;
const rotationSpeed = 3;
let dashMultiplier = 1;
const allowFly = true;
const allowUnderground = true;

// Key input
document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": keys.add("forward"); break;
    case "KeyS": keys.add("backward"); break;
    case "KeyA": keys.add("left"); break;
    case "KeyD": keys.add("right"); break;
    case "Space": keys.add("up"); break;
    case "ControlLeft": keys.add("down"); break;
    case "ShiftLeft": dashMultiplier = 2; break;
  }
  updateAnimation();
});

document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": keys.delete("forward"); break;
    case "KeyS": keys.delete("backward"); break;
    case "KeyA": keys.delete("left"); break;
    case "KeyD": keys.delete("right"); break;
    case "Space": keys.delete("up"); break;
    case "ControlLeft": keys.delete("down"); break;
    case "ShiftLeft": dashMultiplier = 1; break;
  }
  updateAnimation();
});

function updateAnimation() {
  const hasMovement = keys.size > 0;
  let targetState: "Idle" | "Walk" | "Run";

  if (!hasMovement) {
    targetState = "Idle";
  } else if (dashMultiplier > 1) {
    targetState = "Run";
  } else {
    targetState = "Walk";
  }

  if (targetState !== currentState) {
    modelLayer.ref.crossFadeAnimation(currentState, targetState, 0.3);
    currentState = targetState;
  }
}

let lastTime = performance.now();

function tick(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  const modelObject = modelLayer.ref.raw;
  const curPos = modelLayer.ref.getWorldPosition();
  if (!modelObject || !curPos) {
    requestAnimationFrame(tick);
    return;
  }

  let dirX = 0, dirY = 0, dirZ = 0;
  if (keys.has("forward")) dirY += 1;
  if (keys.has("backward")) dirY -= 1;
  if (keys.has("left")) dirX -= 1;
  if (keys.has("right")) dirX += 1;
  if (keys.has("up")) dirZ += 1;
  if (keys.has("down")) dirZ -= 1;

  const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
  const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
  const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

  const currentLLE = vector3ToGeodetic(curPos);
  const surfaceNormal = geodeticSurfaceNormal({
    lat: currentLLE.lat,
    lng: currentLLE.lng,
    height: currentLLE.height,
  });

  const modelForward = new Vector3(0, 0, -1).applyQuaternion(modelObject.quaternion);
  const forwardProjected = modelForward
    .clone()
    .sub(surfaceNormal.clone().multiplyScalar(modelForward.dot(surfaceNormal)))
    .normalize();
  let currentYaw = Math.atan2(forwardProjected.dot(east), forwardProjected.dot(north));

  if (dirX !== 0) {
    currentYaw += degreeToRadian(rotationSpeed * dirX);
  }

  const worldForward = east
    .clone()
    .multiplyScalar(Math.sin(currentYaw))
    .add(north.clone().multiplyScalar(Math.cos(currentYaw)));

  const worldRight = worldForward.clone().cross(surfaceNormal).normalize();
  const finalQuaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(worldRight, surfaceNormal, worldForward.clone().negate())
  );
  const finalEuler = new Euler().setFromQuaternion(finalQuaternion);

  if (dirY !== 0) {
    curPos.addScaledVector(worldForward, walkSpeed * dashMultiplier * deltaTime * dirY);
  }

  let height = currentLLE.height + dirZ * walkSpeed * deltaTime;
  const curLLE = vector3ToGeodetic(curPos);
  const terrainHeight = view.sampleTerrainHeight({ lat: curLLE.lat, lng: curLLE.lng, height: 0 }) ?? 0;

  if (allowFly) {
    if (!allowUnderground) {
      height = Math.max(height, terrainHeight);
    }
  } else {
    height = terrainHeight;
  }

  const finalPos = geodeticToVector3({ lat: curLLE.lat, lng: curLLE.lng, height });

  modelLayer.update({
    position: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
    rotation: { x: finalEuler.x, y: finalEuler.y, z: finalEuler.z },
  });

  view.cameraFollow(
    true,
    { lat: radianToDegree(curLLE.lat), lng: radianToDegree(curLLE.lng), height: height + 1 }
  );

  requestAnimationFrame(tick);
}

modelLayer.ref.on("load", () => {
  requestAnimationFrame(tick);
});
```

:::tip[Customization Tips]
- **Explore a different building**: Change the `cesium3dtiles` layer URL to load a different PLATEAU model
- **Adjust movement speed**: Modify the `walkSpeed` and `rotationSpeed` values to tune the controls
- **Adjust camera position**: Adjust the camera offset using the second argument of `view.lookAt()`
- **First-person view**: Instead of `view.cameraFollow()`, set the camera directly at the model's head position for a first-person perspective
:::
