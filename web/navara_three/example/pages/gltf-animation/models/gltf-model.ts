// GLTF Model related functions

import ThreeView, {
  type LayerHandle,
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  Color,
} from "@navara/three";
import type { GLTFModelLayer } from "@navara/three_default_layers";
import type { DefaultLayerDescriptions } from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler } from "three";
import { Pane, type FolderApi } from "tweakpane";

import { addFieldsToFolder, type FolderFields } from "../../../helpers/panel";
import { SAPPORO_GEOJSON, OSAKA_GEOJSON, MODEL_CONFIG } from "../constants";
import type {
  AnimationState,
  AnimationWeights,
  AnimationControlParams,
  AnimationControlReturn,
  BlendWeightApis,
} from "../types";
import {
  getCrossfadeWeights,
  getCurrentPrimaryAnimation,
} from "../utils/animation-utils";

// Helper function to extract coordinates from GeoJSON
function getCoordinatesFromGeoJSON(geojson: typeof SAPPORO_GEOJSON) {
  const [longitude, latitude] = geojson.geometry.coordinates;
  return {
    latitude,
    longitude,
    altitude: 0, // Default altitude for GLTF model
  };
}

// Extract coordinates from GeoJSON for calculations
const SAPPORO_COORDINATES = getCoordinatesFromGeoJSON(SAPPORO_GEOJSON);

/**
 * Add GLTF model for normal surface alignment
 */
export const addTestModelForNormal = (
  view: ThreeView<DefaultLayerDescriptions>,
): LayerHandle<GLTFModelLayer> => {
  const pos = geodeticToVector3({
    lat: degreeToRadian(SAPPORO_COORDINATES.latitude),
    lng: degreeToRadian(SAPPORO_COORDINATES.longitude),
    height: SAPPORO_COORDINATES.altitude,
  });
  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(SAPPORO_COORDINATES.latitude),
    lng: degreeToRadian(SAPPORO_COORDINATES.longitude),
    height: SAPPORO_COORDINATES.altitude,
  });

  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model using GLTFModelLayer with URL
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: MODEL_CONFIG.url,
      // Animation configuration - fully aligned with Rust naming
      animationEnabled: true,
      animationActiveClip: "Idle",
      animationSpeed: 1.0,
      animationLoop: true,
      animationAutoPlay: false,
      animationCrossfadeDuration: 0.3,
    },
    scale: MODEL_CONFIG.scale,
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  // Add arrow helper
  view.addLayer({
    type: "mesh",
    arrowHelper: {
      direction: normal,
      origin: pos,
      length: 5000000,
      color: new Color().setStyle("#ffffff"),
      headLength: 400000,
      headWidth: 70000,
    },
  });

  return modelLayer;
};

/**
 * Add text model control panel
 */
export const addTextModelControl = (
  _view: ThreeView<DefaultLayerDescriptions>,
  pane: Pane | FolderApi,
  modelLayer: LayerHandle<GLTFModelLayer>,
): AnimationControlReturn => {
  // Control parameters
  const PARAMS: AnimationControlParams = {
    showModel: true,
    showSkeleton: false,
    useDefaultDuration: true,
    customDuration: 3.5,
    idleWeight: 0,
    walkWeight: 0,
    runWeight: 0,
    timeScale: 1,
  };

  // Helpers to sync Crossfading with Blend Weights UI
  let isProgrammaticUpdate = false;
  let crossfadeRaf: number | null = null;
  let defaultWeights: readonly AnimationWeights[] = [
    { name: "Idle", weight: 0 },
    { name: "Walk", weight: 0 },
    { name: "Run", weight: 0 },
  ];

  // Store field APIs for programmatic updates
  let blendWeightApis: BlendWeightApis;

  // Get current crossfade duration
  function getCrossfadeDuration(): number {
    return PARAMS.useDefaultDuration ? 1.0 : PARAMS.customDuration;
  }

  function startCrossfadeSync(
    from: AnimationState,
    to: AnimationState,
    duration: number,
  ): void {
    if (crossfadeRaf !== null) cancelAnimationFrame(crossfadeRaf);
    const start = performance.now();
    const loop = () => {
      const now = performance.now();
      const t = Math.min((now - start) / (duration * 1000), 1);
      const weights = getCrossfadeWeights(from, to, t);

      isProgrammaticUpdate = true;
      PARAMS.idleWeight = weights.idle;
      PARAMS.walkWeight = weights.walk;
      PARAMS.runWeight = weights.run;
      BLEND_PARAMS.idleWeight = weights.idle;
      BLEND_PARAMS.walkWeight = weights.walk;
      BLEND_PARAMS.runWeight = weights.run;
      blendWeightApis.idleWeight.refresh();
      blendWeightApis.walkWeight.refresh();
      blendWeightApis.runWeight.refresh();
      isProgrammaticUpdate = false;

      if (t < 1) {
        crossfadeRaf = requestAnimationFrame(loop);
      } else {
        crossfadeRaf = null;
      }
    };
    loop();
  }

  // Visibility folder
  const visibilityFolder = pane.addFolder({
    title: "Visibility",
    expanded: true,
  });

  visibilityFolder.addBinding(PARAMS, "showModel").on("change", (_v) => {
    modelLayer.visible = _v.value;
  });

  // Activation/Deactivation folder
  const activationFolder = pane.addFolder({
    title: "Activation/Deactivation",
    expanded: true,
  });

  activationFolder
    .addButton({
      title: "deactivate all",
    })
    .on("click", () => {
      modelLayer.ref.stopAllAnimations();
    });

  activationFolder
    .addButton({
      title: "activate all",
    })
    .on("click", () => {
      // Apply current Blend Weights values
      updateBlendWeights();
    });

  // Crossfading folder
  const crossfadingFolder = pane.addFolder({
    title: "Crossfading",
    expanded: true,
  });

  // Start crossfade with duration-based button control
  function startCrossfadeWithButtonControl(
    from: AnimationState,
    to: AnimationState,
  ): void {
    const duration = getCrossfadeDuration();

    // Start animation
    modelLayer.ref.crossFadeAnimation(from, to, duration);
    startCrossfadeSync(from, to, duration);

    // Disable all buttons during crossfade
    disableAllCrossfadeButtons();

    // Enable appropriate buttons after crossfade completes
    setTimeout(() => {
      enableButtonsForAnimation(to);
    }, duration * 1000);
  }

  // Create buttons and store references for dynamic enable/disable
  const walkToIdleButton = crossfadingFolder
    .addButton({
      title: "from walk to idle",
    })
    .on("click", () => {
      startCrossfadeWithButtonControl("Walk", "Idle");
    });

  const idleToWalkButton = crossfadingFolder
    .addButton({
      title: "from idle to walk",
    })
    .on("click", () => {
      startCrossfadeWithButtonControl("Idle", "Walk");
    });

  const walkToRunButton = crossfadingFolder
    .addButton({
      title: "from walk to run",
    })
    .on("click", () => {
      startCrossfadeWithButtonControl("Walk", "Run");
    });

  const runToWalkButton = crossfadingFolder
    .addButton({
      title: "from run to walk",
    })
    .on("click", () => {
      startCrossfadeWithButtonControl("Run", "Walk");
    });

  // Store button references for dynamic enable/disable
  const crossfadeButtons = {
    walkToIdle: walkToIdleButton,
    idleToWalk: idleToWalkButton,
    walkToRun: walkToRunButton,
    runToWalk: runToWalkButton,
  };

  // Disable all crossfade buttons
  function disableAllCrossfadeButtons(): void {
    crossfadeButtons.walkToIdle.disabled = true;
    crossfadeButtons.idleToWalk.disabled = true;
    crossfadeButtons.walkToRun.disabled = true;
    crossfadeButtons.runToWalk.disabled = true;
  }

  // Enable buttons based on animation state
  function enableButtonsForAnimation(animation: AnimationState): void {
    // First disable all
    disableAllCrossfadeButtons();

    // Enable buttons based on current animation
    switch (animation) {
      case "Walk":
        crossfadeButtons.walkToIdle.disabled = false;
        crossfadeButtons.walkToRun.disabled = false;
        break;
      case "Idle":
        crossfadeButtons.idleToWalk.disabled = false;
        break;
      case "Run":
        crossfadeButtons.runToWalk.disabled = false;
        break;
    }
  }

  // Update button states based on current weights
  function updateButtonStatesBasedOnWeights(): void {
    const weights = {
      idle: PARAMS.idleWeight,
      walk: PARAMS.walkWeight,
      run: PARAMS.runWeight,
    };
    const currentAnimation = getCurrentPrimaryAnimation(weights);
    if (currentAnimation) {
      enableButtonsForAnimation(currentAnimation);
    } else {
      // If no clear primary animation, disable all buttons
      disableAllCrossfadeButtons();
    }
  }

  crossfadingFolder.addBinding(PARAMS, "useDefaultDuration");

  crossfadingFolder.addBinding(PARAMS, "customDuration", {
    min: 0.1,
    max: 10.0,
    step: 0.1,
  });

  // Blend Weights folder - Type-safe implementation
  const blendWeightsFolder = pane.addFolder({
    title: "Blend Weights",
    expanded: true,
  });

  const BLEND_PARAMS = {
    idleWeight: PARAMS.idleWeight,
    walkWeight: PARAMS.walkWeight,
    runWeight: PARAMS.runWeight,
  };

  const blendFields: FolderFields<typeof BLEND_PARAMS> = [
    {
      name: "idleWeight",
      params: { min: 0, max: 1, step: 0.01 },
      onMount: (apis) => {
        blendWeightApis = {
          idleWeight: apis.idleWeight,
          walkWeight: apis.walkWeight,
          runWeight: apis.runWeight,
        };
      },
      onChange: (v, _apis) => {
        if (isProgrammaticUpdate) return;
        PARAMS.idleWeight = v.value;
        updateBlendWeights();
        // Update button states when weights change
        setTimeout(() => updateButtonStatesBasedOnWeights(), 50);
      },
    },
    {
      name: "walkWeight",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v, _apis) => {
        if (isProgrammaticUpdate) return;
        PARAMS.walkWeight = v.value;
        updateBlendWeights();
        // Update button states when weights change
        setTimeout(() => updateButtonStatesBasedOnWeights(), 50);
      },
    },
    {
      name: "runWeight",
      params: { min: 0, max: 1, step: 0.01 },
      onChange: (v, _apis) => {
        if (isProgrammaticUpdate) return;
        PARAMS.runWeight = v.value;
        updateBlendWeights();
        // Update button states when weights change
        setTimeout(() => updateButtonStatesBasedOnWeights(), 50);
      },
    },
  ];

  addFieldsToFolder(blendWeightsFolder, BLEND_PARAMS, blendFields);

  // Reset weights to initial defaults (placed at bottom)
  blendWeightsFolder.addButton({ title: "reset weights" }).on("click", () => {
    applyWeights(defaultWeights);
  });

  // General Speed folder
  const generalSpeedFolder = pane.addFolder({
    title: "General Speed",
    expanded: true,
  });

  generalSpeedFolder
    .addBinding(PARAMS, "timeScale", {
      min: 0.1,
      max: 3.0,
      step: 0.1,
    })
    .on("change", (v) => {
      modelLayer.ref.setAnimationSpeed(v.value);
    });

  // Helper function to update blend weights
  function updateBlendWeights() {
    const animations: { name: string; weight: number }[] = [];
    if (PARAMS.idleWeight > 0)
      animations.push({ name: "Idle", weight: PARAMS.idleWeight });
    if (PARAMS.walkWeight > 0)
      animations.push({ name: "Walk", weight: PARAMS.walkWeight });
    if (PARAMS.runWeight > 0)
      animations.push({ name: "Run", weight: PARAMS.runWeight });

    const state = modelLayer.ref.getAnimationCurrentState();

    if (!state.isBlendMode) {
      // Enter blend mode with current non-zero weights
      if (animations.length > 0) {
        modelLayer.ref.blendAnimations(animations);
      } else {
        // No animations requested, stop all
        modelLayer.ref.stopAllAnimations();
      }
      return;
    }

    // Already in blend mode: adjust weights incrementally
    const weightMap = new Map<string, number>(
      animations.map((a) => [a.name, a.weight]),
    );
    (["Idle", "Walk", "Run"] as const).forEach((name) => {
      const w = weightMap.get(name) ?? 0;
      modelLayer.ref.setAnimationWeight(name as string, w);
    });
  }

  function applyWeights(weights: readonly AnimationWeights[]): void {
    // Update UI values and refresh without triggering change handlers
    const weightMap = new Map<string, number>(
      weights.map((w) => [w.name, w.weight]),
    );
    isProgrammaticUpdate = true;
    PARAMS.idleWeight = weightMap.get("Idle") ?? 0;
    PARAMS.walkWeight = weightMap.get("Walk") ?? 0;
    PARAMS.runWeight = weightMap.get("Run") ?? 0;
    BLEND_PARAMS.idleWeight = PARAMS.idleWeight;
    BLEND_PARAMS.walkWeight = PARAMS.walkWeight;
    BLEND_PARAMS.runWeight = PARAMS.runWeight;
    blendWeightApis.idleWeight?.refresh?.();
    blendWeightApis.walkWeight?.refresh?.();
    blendWeightApis.runWeight?.refresh?.();
    isProgrammaticUpdate = false;

    const state = modelLayer.ref.getAnimationCurrentState();
    const asArray = weights as { name: string; weight: number }[];
    if (!state.isBlendMode) {
      modelLayer.ref.blendAnimations(asArray);
    } else {
      ["Idle", "Walk", "Run"].forEach((name) => {
        const w = weightMap.get(name) ?? 0;
        modelLayer.ref.setAnimationWeight(name as string, w);
      });
    }
  }

  function setDefaultWeights(weights: readonly AnimationWeights[]): void {
    defaultWeights = weights;
  }

  return { applyWeights, setDefaultWeights };
};

/**
 * Add GLTF model that runs around the earth
 * Fixed latitude, changing longitude over time
 */
export const addRunningModelAroundEarth = (
  view: ThreeView<DefaultLayerDescriptions>,
): LayerHandle<GLTFModelLayer> => {
  const OSAKA_COORDINATES = getCoordinatesFromGeoJSON(OSAKA_GEOJSON);

  const pos = geodeticToVector3({
    lat: degreeToRadian(OSAKA_COORDINATES.latitude),
    lng: degreeToRadian(OSAKA_COORDINATES.longitude),
    height: OSAKA_COORDINATES.altitude,
  });
  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(OSAKA_COORDINATES.latitude),
    lng: degreeToRadian(OSAKA_COORDINATES.longitude),
    height: OSAKA_COORDINATES.altitude,
  });

  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model with Run animation fixed
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: MODEL_CONFIG.url,
      animationEnabled: true,
      animationActiveClip: "Run",
      animationSpeed: 1.0,
      animationLoop: true,
      animationAutoPlay: true,
    },
    scale: MODEL_CONFIG.scale,
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
  });

  return modelLayer;
};

/**
 * Add running model control panel
 */
export const addRunningModelControl = (pane: Pane | FolderApi) => {
  // Running model parameters
  const runningModelParams = {
    movementSpeed: 0.01, // degrees per frame
    direction: "West" as "East" | "West",
  };

  // Add direction control
  pane.addBinding(runningModelParams, "direction", {
    label: "Direction",
    options: {
      East: "East",
      West: "West",
    },
  });

  // Add speed control
  pane.addBinding(runningModelParams, "movementSpeed", {
    label: "Movement Speed",
    min: 0.001,
    max: 0.1,
    step: 0.001,
  });

  return runningModelParams;
};
