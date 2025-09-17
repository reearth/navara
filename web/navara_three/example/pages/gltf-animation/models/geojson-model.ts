// GeoJSON Model related functions

import ThreeView, { type LayerHandle } from "@navara/three";
import { type FolderApi } from "tweakpane";

import { TOKYO_STATION_COORDINATES, MODEL_CONFIG } from "../constants";
import type { AnimationState } from "../types";

/**
 * Add GeoJSON animated model
 */
export const addGeoJsonAnimatedModel = (_view: ThreeView): LayerHandle => {
  // Position near Tokyo Station coordinates
  const pos = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [
        TOKYO_STATION_COORDINATES.longitude,
        TOKYO_STATION_COORDINATES.latitude,
      ],
    },
  };

  return _view.addLayer({
    type: "geojson",
    data: pos,
    model: {
      show: true,
      size: MODEL_CONFIG.size,
      clamp_to_ground: true,
      // Minimal animation config for GeoJSON model
      url: MODEL_CONFIG.url,
      animation_active_clip: "Walk",
      animation_speed: 1.0,
    },
  });
};

/**
 * Add GeoJSON model control panel
 */
export const addGeoJsonModelControl = (
  view: ThreeView,
  folder: FolderApi,
  initialLayer: LayerHandle,
): void => {
  // Control parameters for GeoJSON model
  const PARAMS = {
    animationSpeed: 1.0,
    currentAnimation: "Walk" as AnimationState,
    modelSize: MODEL_CONFIG.size,
  };

  // Keep track of current layer
  let currentGeoJsonLayer = initialLayer;

  const pos = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [
        TOKYO_STATION_COORDINATES.longitude,
        TOKYO_STATION_COORDINATES.latitude,
      ],
    },
  };

  // Function to recreate the layer with minimal T-pose visibility
  const updateLayer = () => {
    // Create new layer first to minimize gap
    const newLayer = view.addLayer({
      type: "geojson",
      data: pos,
      model: {
        show: true,
        size: PARAMS.modelSize,
        clamp_to_ground: true,
        url: MODEL_CONFIG.url,
        animation_active_clip: PARAMS.currentAnimation,
        animation_speed: PARAMS.animationSpeed,
      },
    }) as LayerHandle;

    // Delete the old layer after new one is created
    currentGeoJsonLayer.delete();

    // Update reference to new layer
    currentGeoJsonLayer = newLayer;
  };

  // Animation switching buttons
  const switchingFolder = folder.addFolder({
    title: "Animation Switching",
    expanded: true,
  });

  switchingFolder
    .addButton({
      title: "Idle",
    })
    .on("click", () => {
      PARAMS.currentAnimation = "Idle";
      updateLayer();
    });

  switchingFolder
    .addButton({
      title: "Walk",
    })
    .on("click", () => {
      PARAMS.currentAnimation = "Walk";
      updateLayer();
    });

  switchingFolder
    .addButton({
      title: "Run",
    })
    .on("click", () => {
      PARAMS.currentAnimation = "Run";
      updateLayer();
    });

  // Size presets
  const sizePresetsFolder = folder.addFolder({
    title: "Size Presets",
    expanded: true,
  });

  sizePresetsFolder
    .addButton({
      title: "Small Model",
    })
    .on("click", () => {
      PARAMS.modelSize = 150000;
      updateLayer();
    });

  sizePresetsFolder
    .addButton({
      title: "Medium Model",
    })
    .on("click", () => {
      PARAMS.modelSize = 300000;
      updateLayer();
    });

  sizePresetsFolder
    .addButton({
      title: "Large Model",
    })
    .on("click", () => {
      PARAMS.modelSize = 450000;
      updateLayer();
    });

  // Speed presets
  const speedPresetsFolder = folder.addFolder({
    title: "Speed Presets",
    expanded: true,
  });

  speedPresetsFolder
    .addButton({
      title: "Slow (0.5x)",
    })
    .on("click", () => {
      PARAMS.animationSpeed = 0.5;
      updateLayer();
    });

  speedPresetsFolder
    .addButton({
      title: "Normal (1.0x)",
    })
    .on("click", () => {
      PARAMS.animationSpeed = 1.0;
      updateLayer();
    });

  speedPresetsFolder
    .addButton({
      title: "Fast (2.0x)",
    })
    .on("click", () => {
      PARAMS.animationSpeed = 2.0;
      updateLayer();
    });

  speedPresetsFolder
    .addButton({
      title: "Very Fast (3.0x)",
    })
    .on("click", () => {
      PARAMS.animationSpeed = 3.0;
      updateLayer();
    });
};
