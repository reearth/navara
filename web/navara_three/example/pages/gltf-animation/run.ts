import ThreeView, {
  type GLTFModelLayer,
  type LayerHandle,
} from "@navara/three";
import {
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
  LLE,
} from "@navara/three_api";
import { Vector3, Quaternion, Euler } from "three";
import { Pane } from "tweakpane";

import { addHidePaneKeyShortcut } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.animation = true;

  view.addDefaultAtmosphereLayers();

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [138.64270223212833, 35.42793245331515],
          [138.8398612065625, 35.42635304536398],
          [138.64071756664583, 35.33027587314082],
          [138.8449071750585, 35.32671062382879],
        ],
        type: "LineString",
      },
    },
    polyline: {
      color: 0xff0000,
      width: 2,
    },
  });

  view.addLayer({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {},
  });

  // Create control panel
  const pane = new Pane({
    title: "Controls",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const modelLayer = addTestModelForNormal(view);
  addGeoJsonAnimatedModel(view);
  const controls = addTextModelControl(view, pane, modelLayer);

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
};

const addTestModelForNormal = (
  view: ThreeView,
): LayerHandle<GLTFModelLayer> => {
  const pos = geodeticToVector3(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );
  const normal = geodeticSurfaceNormal(
    new LLE(degreeToRadian(43.0618), degreeToRadian(141.3545), 0),
  );

  // Calculate rotation to align model with surface normal
  const up = new Vector3(0, 1, 0);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal);
  const euler = new Euler().setFromQuaternion(quaternion);

  // Add GLTF model using GLTFModelLayer with URL
  const modelLayer = view.addLayer<GLTFModelLayer>({
    type: "mesh",
    gltfModel: {
      url: "/glTF/Soldier/Soldier.glb",
      // Animation configuration - fully aligned with Rust naming
      animation_enabled: true,
      animation_active_clip: "Idle",
      animation_speed: 1.0,
      animation_loop: true,
      animation_auto_play: false,
      animation_crossfade_duration: 0.3,
    },
    scale: { x: 300000, y: 300000, z: 300000 },
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
      color: 0xffffff,
      headLength: 400000,
      headWidth: 70000,
    },
  });

  return modelLayer;
};

const addTextModelControl = (
  _view: ThreeView,
  pane: Pane,
  modelLayer: LayerHandle<GLTFModelLayer>,
): {
  applyWeights: (
    weights: readonly { name: "Idle" | "Walk" | "Run"; weight: number }[],
  ) => void;
  setDefaultWeights: (
    weights: readonly { name: "Idle" | "Walk" | "Run"; weight: number }[],
  ) => void;
} => {
  // Control parameters
  const PARAMS = {
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
  let defaultWeights: readonly {
    name: "Idle" | "Walk" | "Run";
    weight: number;
  }[] = [
    { name: "Idle", weight: 0 },
    { name: "Walk", weight: 0 },
    { name: "Run", weight: 0 },
  ];

  // Store field APIs for programmatic updates
  let blendWeightApis: {
    idleWeight: { refresh: () => void };
    walkWeight: { refresh: () => void };
    runWeight: { refresh: () => void };
  };

  // Animation state type
  type AnimationState = "Idle" | "Walk" | "Run";

  // Get current crossfade duration
  function getCrossfadeDuration(): number {
    return PARAMS.useDefaultDuration ? 1.0 : PARAMS.customDuration;
  }

  // Function to get current primary animation state
  function getCurrentPrimaryAnimation(): AnimationState | null {
    const weights = {
      idle: PARAMS.idleWeight,
      walk: PARAMS.walkWeight,
      run: PARAMS.runWeight,
    };

    // Find the animation with the highest weight
    let maxWeight = 0;
    let primaryAnimation: AnimationState | null = null;

    if (weights.idle > maxWeight) {
      maxWeight = weights.idle;
      primaryAnimation = "Idle";
    }
    if (weights.walk > maxWeight) {
      maxWeight = weights.walk;
      primaryAnimation = "Walk";
    }
    if (weights.run > maxWeight) {
      maxWeight = weights.run;
      primaryAnimation = "Run";
    }

    // Only return primary animation if it has significant weight (> 0.5)
    return maxWeight > 0.5 ? primaryAnimation : null;
  }

  function startCrossfadeSync(
    from: "Idle" | "Walk" | "Run",
    to: "Idle" | "Walk" | "Run",
    duration: number,
  ) {
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

  function getCrossfadeWeights(
    from: "Idle" | "Walk" | "Run",
    to: "Idle" | "Walk" | "Run",
    t: number,
  ) {
    const w = { idle: 0, walk: 0, run: 0 };
    const vFrom = Math.max(0, 1 - t);
    const vTo = Math.max(0, t);

    // 関与するアニメーションのみ重みを設定
    if (from === "Idle") w.idle = vFrom;
    if (from === "Walk") w.walk = vFrom;
    if (from === "Run") w.run = vFrom;
    if (to === "Idle") w.idle = vTo;
    if (to === "Walk") w.walk = vTo;
    if (to === "Run") w.run = vTo;

    // 関係のないアニメーションの重みを明示的に0にする
    if (
      (from === "Walk" && to === "Idle") ||
      (from === "Idle" && to === "Walk")
    ) {
      w.run = 0; // walk ↔ idle の時はrunを0に
    }

    if (
      (from === "Walk" && to === "Run") ||
      (from === "Run" && to === "Walk")
    ) {
      w.idle = 0; // walk ↔ run の時はidleを0に
    }

    // idle ↔ run の場合はwalkを0に（将来的な拡張のため）
    if (
      (from === "Idle" && to === "Run") ||
      (from === "Run" && to === "Idle")
    ) {
      w.walk = 0;
    }

    return w;
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

  // Pausing/Stepping controls removed per request

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
    const currentAnimation = getCurrentPrimaryAnimation();
    if (currentAnimation) {
      enableButtonsForAnimation(currentAnimation);
    } else {
      // If no clear primary animation, disable all buttons
      disableAllCrossfadeButtons();
    }
  }

  crossfadingFolder.addBinding(PARAMS, "useDefaultDuration");

  // Default duration is fixed to 1.0s, no slider needed

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

  function applyWeights(
    weights: readonly { name: "Idle" | "Walk" | "Run"; weight: number }[],
  ) {
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

  function setDefaultWeights(
    weights: readonly { name: "Idle" | "Walk" | "Run"; weight: number }[],
  ) {
    defaultWeights = weights;
  }

  return { applyWeights, setDefaultWeights };
};

const addGeoJsonAnimatedModel = (_view: ThreeView) => {
  // Position near Tokyo Station coordinates
  const pos = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [139.7671, 35.6812] },
  };

  _view.addLayer({
    type: "geojson",
    data: pos,
    model: {
      show: true,
      size: 300000,
      clamp_to_ground: true,
      // Minimal animation config for GeoJSON model
      url: "/glTF/Soldier/Soldier.glb",
      animation_active_clip: "Walk",
      animation_speed: 2.0,
    },
  });
};
