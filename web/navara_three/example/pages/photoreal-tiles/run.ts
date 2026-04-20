import ThreeView from "@navara/three";
import type { Layer } from "@navara/three";
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

  const content = showAttributions([TILES_3D_DATASETS.googlePhotorealTiles]);

  addTokenControl(view, pane, content);
  addCameraControl(view, pane);
  addDateControl(view, pane);
};

function addTokenControl(
  view: ThreeView,
  pane: Pane,
  content: HTMLDivElement | undefined,
) {
  let currentLayer: Layer | undefined;

  const addTileLayer = (token: string) => {
    if (currentLayer) {
      currentLayer.delete();
    }
    if (!token) return;

    currentLayer = view.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(token)}`,
      },
      model: {
        maxSse: 60,
      },
    });
    trackAttributions(currentLayer, content);
  };

  const PARAMS = {
    // Don't bundle the API key in the production build.
    token: import.meta.env.PROD
      ? ""
      : (import.meta.env.NAVARA_GOOGLE_MAPS_API_KEY ?? ""),
  };

  pane
    .addBinding(PARAMS, "token", {
      label: "Google Maps API Key",
    })
    .on("change", (ev) => {
      addTileLayer(ev.value);
    });

  // Add initial layer if token exists
  if (PARAMS.token) {
    addTileLayer(PARAMS.token);
  }
}

// Track credits for all loaded features
function trackAttributions(layer: Layer, content: HTMLDivElement | undefined) {
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

    if (content) {
      const sorted = Array.from(visibleCredits.entries()).sort(
        (a, b) => b[1] - a[1],
      );
      content.innerHTML = sorted.map(([credit, _]) => `${credit}`).join("<br>");
    }
  };

  layer.on("featureCreated", ({ featureSetId, credit }) => {
    if (credit) {
      featureCredits.set(featureSetId, credit);
    }
    // New features start as visible
    visibleFeatures.add(featureSetId);
    updateAttributions();
  });

  layer.on("featureRemoved", ({ featureSetId }) => {
    featureCredits.delete(featureSetId);
    visibleFeatures.delete(featureSetId);
    updateAttributions();
  });

  layer.on("featureVisibilityChanged", ({ featureSetId, visible }) => {
    if (visible) {
      visibleFeatures.add(featureSetId);
    } else {
      visibleFeatures.delete(featureSetId);
    }
    updateAttributions();
  });
}
