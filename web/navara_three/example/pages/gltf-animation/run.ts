// GLTF Animation Example - Main Entry Point

import ThreeView, {
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler, Matrix4 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../helpers/control";

import { OSAKA_GEOJSON } from "./constants";
import {
  addTestModelForNormal,
  addTextModelControl,
  addRunningModelAroundEarth,
  addRunningModelControl,
} from "./models/gltf-model";

/**
 * Main function to run the GLTF Animation example
 */
export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.animation = true;

  // Add default atmosphere layers
  plugin.addDefaultPhotorealScene();

  // Add base tile layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  // Create control panel
  const pane = new Pane({
    title: "Animation Controls",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  // Create folders for each model
  const gltfFolder = pane.addFolder({
    title: "GLTF Model (Sapporo)",
    expanded: true,
  });

  const runningModelFolder = pane.addFolder({
    title: "Running Model (Osaka)",
    expanded: true,
  });

  // Add models and their controls
  const modelLayer = addTestModelForNormal(view);
  const controls = addTextModelControl(view, gltfFolder, modelLayer);

  // Wait for animation initialization, then set initial blend and sync UI
  modelLayer.ref.on("animationReady", () => {
    // Initial blend at this timing becomes the UI initial values
    const initialWeights = [
      { name: "Idle", weight: 0.2 },
      { name: "Walk", weight: 0.5 },
      { name: "Run", weight: 0.3 },
    ] as const;
    // Remember these as the default weights for Reset button
    controls.setDefaultWeights(initialWeights);
    controls.applyWeights(initialWeights);
  });

  // Add running model around earth
  const runningModel = addRunningModelAroundEarth(view);
  const runningModelParams = addRunningModelControl(runningModelFolder);

  // Animation loop - move the running model around the earth
  const [initialLongitude, initialLatitude] =
    OSAKA_GEOJSON.geometry.coordinates;
  let longitude = initialLongitude;
  const latitude = initialLatitude; // Fixed latitude
  const altitude = 0;

  let previousPos: Vector3 | null = null;

  const animate = () => {
    // Update longitude (move around the earth)
    const speedMultiplier = runningModelParams.direction === "East" ? 1 : -1;
    longitude += runningModelParams.movementSpeed * speedMultiplier;

    // Wrap longitude within -180 to 180 range
    if (longitude > 180) {
      longitude -= 360;
    } else if (longitude < -180) {
      longitude += 360;
    }

    // Calculate new position
    const pos = geodeticToVector3({
      lat: degreeToRadian(latitude),
      lng: degreeToRadian(longitude),
      height: altitude,
    });

    // Calculate surface normal at new position
    const normal = geodeticSurfaceNormal({
      lat: degreeToRadian(latitude),
      lng: degreeToRadian(longitude),
      height: altitude,
    });

    // Calculate direction of movement
    let direction: Vector3;
    if (previousPos) {
      direction = new Vector3().subVectors(pos, previousPos).normalize();
    } else {
      // For first frame, calculate direction from next position
      const nextLongitude =
        longitude + runningModelParams.movementSpeed * speedMultiplier;
      const nextPos = geodeticToVector3({
        lat: degreeToRadian(latitude),
        lng: degreeToRadian(nextLongitude),
        height: altitude,
      });
      direction = new Vector3().subVectors(nextPos, pos).normalize();
    }

    // Create rotation matrix to align model with movement direction
    // with the normal as the up vector
    const quaternion = new Quaternion();

    // Calculate the right vector (perpendicular to both direction and normal)
    const right = new Vector3().crossVectors(direction, normal).normalize();

    // Recalculate the up vector to ensure orthogonality
    const up = new Vector3().crossVectors(right, direction).normalize();

    // Create rotation matrix from direction vectors
    // Three.js uses column-major order
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeBasis(right, up, direction.clone().negate());

    quaternion.setFromRotationMatrix(rotationMatrix);
    const euler = new Euler().setFromQuaternion(quaternion);

    // Update model position and rotation
    runningModel.update({
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: euler.x, y: euler.y, z: euler.z },
    });

    // Store current position for next frame
    previousPos = pos.clone();

    requestAnimationFrame(animate);
  };

  // Start animation loop
  animate();

  showAttributions([TILE_DATASETS.openstreetmap]);
};
