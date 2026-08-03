/**
 * Memory budget debug page (PLAN P1a/C7).
 *
 * Shows live engine memory stats (WASM buffer bytes, GPU estimates, retained
 * tile counts, evictions) next to browser memory probes, with a cacheBytes
 * slider to watch retention/eviction live and a fly-to button reproducing
 * the z4→z16 descent burst.
 */
import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  VECTOR_DATASETS,
} from "../../../helpers/constants";
import { createMemoryProbe } from "../../../helpers/memoryProbe";

export type CustomDescriptions = DefaultDescriptions;

const MB = 1024 * 1024;

/** Which heavy dataset to load on top of the shared terrain + raster base.
 * Selected via the `dataset` query param so a fresh reload gives a clean
 * memory baseline per dataset. */
type Dataset = "3dtiles" | "mvt";
const DATASET_PARAM = "dataset";

function readDataset(): Dataset {
  const v = new URLSearchParams(window.location.search).get(DATASET_PARAM);
  return v === "mvt" ? "mvt" : "3dtiles";
}

function selectDataset(dataset: Dataset) {
  const url = new URL(window.location.href);
  url.searchParams.set(DATASET_PARAM, dataset);
  // Reload so each dataset starts from a clean memory state (this page exists
  // to measure resident memory; residual layers would muddy the baseline).
  window.location.href = url.toString();
}

const FAR_VIEW = {
  lng: 139.76,
  lat: 35.68,
  height: 8_000_000, // ~z4
  heading: 0,
  pitch: -90,
  roll: 0,
};
const NEAR_VIEW = {
  lng: 139.76,
  lat: 35.68,
  height: 1_200, // ~z16
  heading: 0,
  pitch: -45,
  roll: 0,
};

export const run = async () => {
  const view = new ThreeView<CustomDescriptions>({
    debug: true,
  });

  view.addPlugin(new DefaultPlugin());
  const attribution = view.attribution;

  await view.init();

  view.addLight({ sun: {} });
  view.setCamera({ ...FAR_VIEW });

  const demSource = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  });
  view.addLayer({ type: "terrain", source: demSource });
  view.addLayer({ type: "raster", source: demSource, hillshade: {} });

  const rasterSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({ type: "raster", source: rasterSource });

  const dataset = readDataset();
  const attributions = [TERRAIN_DATASETS.gsi, TILE_DATASETS.openstreetmap];

  if (dataset === "3dtiles") {
    // Chiyoda + Chuo PLATEAU 3D Tiles — exercises the model GPU-byte path.
    for (const ds of [
      TILES_3D_DATASETS.plateauChiyoda,
      TILES_3D_DATASETS.plateauChuo,
    ]) {
      const tilesSource = view.addSource({
        type: "3d-tiles",
        url: ds.url,
      });
      view.addLayer({
        type: "3d-tiles",
        source: tilesSource,
        model: {
          show: true,
          color: new Color().setStyle("#ffffff"),
          metalness: 0,
          roughness: 1,
        },
      });
      attributions.push(ds);
    }
  } else {
    const vectorSource = view.addSource({
      type: "vector-tile",
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
      maxZoom: 16,
    });
    view.addLayer({
      type: "vector",
      source: vectorSource,
      sourceLayers: ["building"],
      polygon: {
        color: new Color().setStyle("#888888"),
        height: 10,
        extrudedHeight: 0,
        clampToGround: true,
        wireframe: false,
      },
    });
    attributions.push(VECTOR_DATASETS.gsiExperimentalVector);
  }

  attribution?.add(attributions);

  // -------------------------------------------------------------------------
  // Memory panel
  // -------------------------------------------------------------------------
  const probe = createMemoryProbe();

  const state = {
    wasmMB: 0,
    jsBufMB: 0,
    attrMB: 0,
    gpuEstMB: 0,
    fixedGpuMB: 0,
    reservedMB: 0,
    jsHeapMB: 0,
    uaMB: 0,
    workerMB: 0,
    fontMB: 0,
    fontAtlasMB: 0,
    bufferCount: 0,
    retained: "",
    evicted: 0,
    sseX: 1,
    budgets: "",
    cacheMB: Math.round((view.cacheBytes ?? 512 * MB) / MB),
    dataset,
  };

  const pane = new Pane({ title: "Memory" });
  pane.element.style.maxHeight = "90vh";
  pane.element.style.overflow = "scroll";

  // Dataset switcher — reloads with the chosen `dataset` query param so each
  // starts from a clean memory baseline.
  pane
    .addBinding(state, "dataset", {
      options: { "3D Tiles (chiyoda+chuo)": "3dtiles", MVT: "mvt" },
    })
    .on("change", (ev) => {
      if (ev.last && ev.value !== dataset) selectDataset(ev.value as Dataset);
    });
  pane.addBinding(state, "wasmMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 1024,
  });
  // JS-side InMemoryBufferStore (WASM External entries): fetched MVT pbf and
  // worker-built geometry kept out of WASM linear memory.
  pane.addBinding(state, "jsBufMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 1024,
  });
  // Feature attribute tables (BatchTable) — invisible to BufferStore but now
  // counted by the ledger. Dominant for attribute-rich data like Overture.
  pane.addBinding(state, "attrMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 2048,
  });
  pane.addBinding(state, "gpuEstMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 1024,
  });
  // Fixed screen-sized allocations (postprocessing render-target stack),
  // reported from the JS side; tracks the drawing-buffer size, not tiles.
  pane.addBinding(state, "fixedGpuMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 512,
  });
  // Dispatch-time reservations for in-flight fetches (ReservedCost): closes the
  // load gate before in-flight decode/upload peaks land.
  pane.addBinding(state, "reservedMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 256,
  });
  pane.addBinding(state, "jsHeapMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 2048,
  });
  if (probe.capabilities.uaSpecificMemory) {
    pane.addBinding(state, "uaMB", {
      readonly: true,
      view: "graph",
      min: 0,
      max: 4096,
    });
  }
  pane.addBinding(state, "workerMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 2048,
  });
  pane.addBinding(state, "fontMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 256,
  });
  pane.addBinding(state, "fontAtlasMB", {
    readonly: true,
    view: "graph",
    min: 0,
    max: 128,
  });
  pane.addBinding(state, "bufferCount", { readonly: true });
  pane.addBinding(state, "retained", { readonly: true });
  pane.addBinding(state, "evicted", { readonly: true });
  // Memory-pressure LOD degrade multiplier (1 = no pressure; rises when the
  // visible set alone exceeds the budget, coarsening far tiles).
  pane.addBinding(state, "sseX", { readonly: true });
  pane.addBinding(state, "budgets", { readonly: true });

  pane
    .addBinding(state, "cacheMB", { min: 64, step: 32 })
    .on("change", (ev) => {
      if (ev.last) view.cacheBytes = ev.value * MB;
    });

  // LOD fog tuning: stronger density/sseFactor coarsens far tiles (near
  // tiles keep full resolution) — used to calibrate the device presets.
  const fogState = {
    density: view.lodFog?.density ?? 2.0e-4,
    sseFactor: view.lodFog?.sseFactor ?? 2.0,
  };
  pane
    .addBinding(fogState, "density", {
      label: "fogDensity",
      min: 1e-5,
      max: 1e-3,
      step: 1e-5,
    })
    .on("change", (ev) => {
      if (ev.last) view.lodFog = { density: ev.value };
    });
  pane
    .addBinding(fogState, "sseFactor", {
      label: "fogSseFactor",
      min: 0,
      max: 8,
      step: 0.5,
    })
    .on("change", (ev) => {
      if (ev.last) view.lodFog = { sseFactor: ev.value };
    });

  // Dynamic SSE (CesiumJS dynamicScreenSpaceError equivalent): tilt-scaled
  // relaxation for street-level horizon views — zero looking straight down,
  // strongest near the ground looking at the horizon. Used to calibrate the
  // default factor/height band (test with "fly street (horizon)").
  const dynamicSseState = {
    enabled: view.dynamicSse?.enabled ?? true,
    density: view.dynamicSse?.density ?? 2.0e-4,
    sseFactor: view.dynamicSse?.sseFactor ?? 24.0,
    heightFalloff: view.dynamicSse?.heightFalloff ?? 0.25,
    maxHeight: view.dynamicSse?.maxHeight ?? 8000,
  };
  pane
    .addBinding(dynamicSseState, "enabled", { label: "dynSse" })
    .on("change", (ev) => {
      if (ev.last) view.dynamicSse = { enabled: ev.value };
    });
  pane
    .addBinding(dynamicSseState, "density", {
      label: "dynSseDensity",
      min: 1e-5,
      max: 1e-3,
      step: 1e-5,
    })
    .on("change", (ev) => {
      if (ev.last) view.dynamicSse = { density: ev.value };
    });
  pane
    .addBinding(dynamicSseState, "sseFactor", {
      label: "dynSseFactor",
      min: 0,
      max: 48,
      step: 1,
    })
    .on("change", (ev) => {
      if (ev.last) view.dynamicSse = { sseFactor: ev.value };
    });
  pane
    .addBinding(dynamicSseState, "heightFalloff", {
      label: "dynSseFalloff",
      min: 0,
      max: 1,
      step: 0.05,
    })
    .on("change", (ev) => {
      if (ev.last) view.dynamicSse = { heightFalloff: ev.value };
    });
  pane
    .addBinding(dynamicSseState, "maxHeight", {
      label: "dynSseMaxHeight",
      min: 1000,
      max: 50000,
      step: 500,
    })
    .on("change", (ev) => {
      if (ev.last) view.dynamicSse = { maxHeight: ev.value };
    });

  // Memory-pressure SSE degrade range. sseMin is the resting multiplier
  // applied even without budget pressure (> 1 keeps far tiles coarse at rest);
  // sseMax is the ceiling the dynamic degrade can climb to under pressure.
  const sseState = { sseMin: 1.0, sseMax: 8.0 };
  const applySseRange = () =>
    view.setSseMultiplierRange(sseState.sseMin, sseState.sseMax);
  pane
    .addBinding(sseState, "sseMin", { min: 1, max: 4, step: 0.5 })
    .on("change", (ev) => {
      if (ev.last) applySseRange();
    });
  // sseMax bottoms out at 1 so `sseMin=sseMax=1` fully disables the pressure
  // degrade (identity `effective_max_sse`) — used to confirm whether the degrade
  // is what suppresses vector overscale / terrain upsampling.
  pane
    .addBinding(sseState, "sseMax", { min: 1, max: 16, step: 0.5 })
    .on("change", (ev) => {
      if (ev.last) applySseRange();
    });

  pane.addButton({ title: "fly far (z4)" }).on("click", () => {
    view.flyTo({ ...FAR_VIEW });
  });
  pane
    .addButton({ title: "fly near (z16) — descent burst" })
    .on("click", () => {
      view.flyTo({ ...NEAR_VIEW });
    });
  // Horizon view at street level: the dynamic-SSE sweet spot (tilt-scaled
  // relaxation at max). Toggle dynSse / drag dynSseFactor while in this view
  // and watch wasmMB / gpuEstMB and the far-tile resolution respond.
  pane.addButton({ title: "fly street (horizon)" }).on("click", () => {
    view.flyTo({ ...NEAR_VIEW, height: 400, pitch: -8 });
  });

  setInterval(async () => {
    const stats = view.memoryStats();
    if (stats) {
      state.wasmMB = stats.bufferTotalBytes / MB;
      state.jsBufMB = stats.externalBufferBytes / MB;
      state.attrMB = stats.externalCpuBytes / MB;
      state.gpuEstMB = stats.gpuBytesEst / MB;
      state.fixedGpuMB = stats.fixedGpuBytes / MB;
      state.reservedMB = stats.reservedBytes / MB;
      state.bufferCount = stats.bufferCount;
      state.retained = `v:${stats.retainedVector} t:${stats.retainedTerrain} r:${stats.retainedRaster} 3d:${stats.retainedTiles3d}`;
      state.evicted = stats.evictedCount;
      state.sseX = stats.sseMultiplier;
    }
    const sample = probe.sampleSync();
    if (sample.jsHeapUsedMB !== undefined) state.jsHeapMB = sample.jsHeapUsedMB;
    const uaMB = await probe.sampleUA();
    if (uaMB !== undefined) state.uaMB = uaMB;

    const workerStats = await view.workerMemoryStats();
    if (workerStats) {
      const tile = workerStats.tileWorkers;
      state.workerMB = (tile?.totalBytes ?? 0) / MB;
      const font = workerStats.fontWorker;
      state.fontMB = (font?.heapBytes ?? 0) / MB;
      state.fontAtlasMB = font
        ? (font.atlasBytes + font.colorAtlasBytes) / MB
        : 0;
      state.budgets = `worker:${Math.round((tile?.maxWorkerHeapBytes ?? 0) / MB)}MB/ea font:${
        font?.budgetBytes !== undefined
          ? `${Math.round(font.budgetBytes / MB)}MB`
          : "-"
      }`;
    }
  }, 1000);
};
