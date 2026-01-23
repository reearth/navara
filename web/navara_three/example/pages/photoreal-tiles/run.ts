import ThreeView from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILES_3D_DATASETS } from "../../helpers/constants";
import { addDateControl, addCameraControl } from "../../helpers/control";

export const run = async (view: ThreeView) => {
  await view.init();

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  const layer = view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.googlePhotorealTiles.url,
    },
    model: {
      maxSse: 60,
    },
  });

  // Track credits for all loaded features
  const featureCredits = new Map<bigint, string>();
  // Track which features are currently visible
  const visibleFeatures = new Set<bigint>();

  // Helper to update the attribution display
  const updateAttributions = () => {
    const visibleCredits = new Map<string, number>();
    for (const id of visibleFeatures) {
      const credit = featureCredits.get(id);
      if (credit) {
        // Split multiple credits separated by semicolon
        credit.split(";").forEach((c) => {
          visibleCredits.set(c.trim(), (visibleCredits.get(c.trim()) ?? 0) + 1);
        });
      }
    }
    const attrib = document.getElementById("navara-attributions-content");
    if (attrib) {
      const sorted = Array.from(visibleCredits.entries()).sort((a, b) => b[1] - a[1]);
      attrib.innerHTML = sorted.map(([credit, _]) => `${credit}`).join("<br>");
    }
  };

  layer.on("featureCreated", ({ id, credit }) => {
    if (credit) {
      featureCredits.set(id, credit);
    }
    // New features start as visible
    visibleFeatures.add(id);
    updateAttributions();
  });

  layer.on("featureRemoved", ({ id }) => {
    featureCredits.delete(id);
    visibleFeatures.delete(id);
    updateAttributions();
  });

  layer.on("featureVisibilityChanged", ({ id, visible }) => {
    if (visible) {
      visibleFeatures.add(id);
    } else {
      visibleFeatures.delete(id);
    }
    updateAttributions();
  });

  addCameraControl(view, pane);
  addDateControl(view, pane);
  showAttributions([TILES_3D_DATASETS.googlePhotorealTiles]);
};
