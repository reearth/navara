import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

type Status = "uninitialized" | "initializing" | "initialized" | "disposed";

let currentView: ThreeView<CustomDescriptions> | undefined;

function createUI() {
  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0,0,0,0.75);
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
  `;

  const statusEl = document.createElement("span");
  statusEl.textContent = "Status: uninitialized";

  const initBtn = document.createElement("button");
  initBtn.textContent = "Initialize";
  initBtn.style.cssText =
    "padding:6px 14px;border-radius:4px;border:none;background:#4caf50;color:#fff;cursor:pointer;font-size:14px;";

  const disposeBtn = document.createElement("button");
  disposeBtn.textContent = "Dispose";
  disposeBtn.style.cssText =
    "padding:6px 14px;border-radius:4px;border:none;background:#f44336;color:#fff;cursor:pointer;font-size:14px;";
  disposeBtn.disabled = true;

  panel.appendChild(statusEl);
  panel.appendChild(initBtn);
  panel.appendChild(disposeBtn);
  document.body.appendChild(panel);

  return {
    setStatus(s: Status) {
      statusEl.textContent = `Status: ${s}`;
      initBtn.disabled = s === "initialized" || s === "initializing";
      disposeBtn.disabled = s !== "initialized";
    },
    onInitialize(fn: () => void) {
      initBtn.addEventListener("click", fn);
    },
    onDispose(fn: () => void) {
      disposeBtn.addEventListener("click", fn);
    },
  };
}

export function run() {
  const ui = createUI();

  async function initialize() {
    ui.setStatus("initializing");

    try {
      const view = new ThreeView<CustomDescriptions>({});
      const plugin = new DefaultPlugin();
      view.addPlugin(plugin);
      await view.init();

      plugin.addDefaultPhotorealScene();

      view.addLayer({
        type: "tiles",
        data: { url: TILE_DATASETS.gsiStd.url },
        rasterTile: { maxZoom: 18 },
      });

      view.addLayer({
        type: "terrain",
        data: {
          url: TERRAIN_DATASETS.gsi.url,
        },
        rasterTerrain: {
          maxZoom: 15,
          minZoom: 6,
          elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
          castShadow: true,
          receiveShadow: true,
        },
      });

      view.addLayer({
        type: "tiles",
        data: { url: TERRAIN_DATASETS.gsi.url },
        rasterTile: {
          maxZoom: 15,
          minZoom: 6,
        },
        hillshade: {
          elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
        },
      });

      view.setCamera({
        lng: 139.6917,
        lat: 35.6895,
        height: 1_000_000,
        heading: 0,
        pitch: -90,
        roll: 0,
      });

      currentView = view;
      ui.setStatus("initialized");
    } catch (e) {
      console.error("Initialize failed:", e);
      ui.setStatus("uninitialized");
    }
  }

  function dispose() {
    if (!currentView) return;
    currentView.dispose();
    currentView = undefined;
    ui.setStatus("disposed");
  }

  ui.onInitialize(initialize);
  ui.onDispose(dispose);

  initialize();
}
