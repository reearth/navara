import ThreeView, {
  Color,
  Layer,
  Source,
  type AttributionItem,
} from "@navaramap/three";
import { AmbientLightDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  MVT_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

let gTileLayer: Layer;
let gGeojsonLayer: Layer;
let gB3dmLayer: Layer;
let gPntsLayer: Layer;
let gMvtLayer: Layer;

// Source handles. Source-level params (URL, zoom/tms) are updated via these
// handles; appearance params (show/color/opacity) via the layer handle.
let gTileSource: Source;
let gGeojsonSource: Source;
let gB3dmSource: Source;
let gPntsSource: Source;
let gMvtSource: Source;

const gTileSourceDesc = {
  type: "raster-tile" as const,
  url: TILE_DATASETS.openstreetmap.url,
  maxZoom: 23,
  minZoom: 0,
  tms: false,
};

// Inline GeoJSON used as one of the GeoJSON source options (a polygon near Mt.
// Fuji). The other option fetches world countries from a URL, to show that a
// source can switch between inline `data` and a fetched `url`.
const FUJI_POLYGON = {
  type: "Feature" as const,
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
    type: "Polygon" as const,
  },
};

/**
 * A camera destination for a dataset, so switching sources frames the object.
 * Uses `distance` (meters from the ground target along the camera forward
 * direction) rather than absolute height, so the object is sized correctly
 * regardless of its scale.
 */
type FlyToTarget = {
  lat: number;
  lng: number;
  distance: number;
  heading?: number;
  pitch?: number;
};

function flyTo(view: ThreeView, target: FlyToTarget) {
  view.flyTo({
    lat: target.lat,
    lng: target.lng,
    height: 0,
    distance: target.distance,
    heading: target.heading ?? 0,
    pitch: target.pitch ?? -45,
    roll: 360,
  });
}

// ---------------------------------------------------------------------------
// Current source selections. The URL switchers mutate these; the source
// factories below read them so a delete + re-add recreates the current config.
// ---------------------------------------------------------------------------

let gGeojsonUsesWorld = false;
let gB3dmUrl = TILES_3D_DATASETS.plateauChiyoda.url;
let gPntsUrl = TILES_3D_DATASETS.plateauKakegawaCastle.url;

// Current fly-to target per layer (updated by the URL switchers), used by each
// layer folder's "fly to" button.
const RASTER_TARGET: FlyToTarget = {
  lat: 35.68,
  lng: 139.76,
  distance: 3_000_000,
  pitch: -89,
};
const GEOJSON_FUJI_TARGET: FlyToTarget = {
  lat: 35.37,
  lng: 138.73,
  distance: 50_000,
  pitch: -55,
};
const GEOJSON_WORLD_TARGET: FlyToTarget = {
  lat: 20,
  lng: 0,
  distance: 25_000_000,
  pitch: -89,
};
let gB3dmTarget: FlyToTarget = {
  lat: 35.6938,
  lng: 139.753,
  distance: 3000,
  pitch: -35,
};
let gPntsTarget: FlyToTarget = {
  lat: 34.7735,
  lng: 138.0164,
  distance: 500,
  pitch: -30,
};

// Every MVT option here is a polygon district dataset, so the layer always
// renders with the polygon appearance; only the URL, source-layer, and color
// differ between options.
type MvtOption = {
  url: string;
  sourceLayers: string[];
  color: number;
  target: FlyToTarget;
};
const MVT_OPTIONS: Record<string, MvtOption> = {
  "Tokyo Fire Prevention District": {
    url: MVT_DATASETS.plateauTokyoFirePrevention.url,
    sourceLayers: ["FirePreventionDistrict"],
    color: 0xff6600,
    target: { lat: 35.6906, lng: 139.7514, distance: 24000, pitch: -55 },
  },
  "Tokyo Height Control District": {
    url: MVT_DATASETS.plateauTokyoHeightControl.url,
    sourceLayers: ["HeightControlDistrict"],
    color: 0x0088ff,
    target: { lat: 35.6906, lng: 139.7514, distance: 24000, pitch: -55 },
  },
};
let gMvtOption: MvtOption = MVT_OPTIONS["Tokyo Fire Prevention District"];

/** The layer config for an MVT option: correct source-layer + polygon color. */
function mvtLayerConfig(source: Source | string, o: MvtOption) {
  return {
    type: "vector" as const,
    source,
    sourceLayers: o.sourceLayers,
    polygon: {
      show: true,
      color: new Color().setHex(o.color),
      clampToGround: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Source + layer factories. Called on initial load and by the "re-add" buttons.
// ---------------------------------------------------------------------------

function createRaster(view: ThreeView) {
  gTileSource = view.addSource(gTileSourceDesc);
  gTileLayer = view.addLayer({ type: "raster", source: gTileSource });
}

function createGeojson(view: ThreeView) {
  gGeojsonSource = view.addSource(
    gGeojsonUsesWorld
      ? { type: "geojson", url: "/globe.geojson" }
      : { type: "geojson", data: FUJI_POLYGON },
  );
  gGeojsonLayer = view.addLayer({
    type: "vector",
    source: gGeojsonSource,
    polygon: { outline: true },
  });
}

function createB3dm(view: ThreeView) {
  gB3dmSource = view.addSource({ type: "3d-tiles", url: gB3dmUrl });
  gB3dmLayer = view.addLayer({
    type: "3d-tiles",
    source: gB3dmSource,
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
    },
  });
}

function createPnts(view: ThreeView) {
  gPntsSource = view.addSource({ type: "3d-tiles", url: gPntsUrl });
  gPntsLayer = view.addLayer({
    type: "3d-tiles",
    source: gPntsSource,
    model: { show: true, pointSize: 0.3, height: 0, maxSse: 16 },
  });
}

function createMvt(view: ThreeView) {
  gMvtSource = view.addSource({
    type: "vector-tile",
    url: gMvtOption.url,
    maxZoom: 16,
  });
  gMvtLayer = view.addLayer(mvtLayerConfig(gMvtSource, gMvtOption));
}

/**
 * Add a "fly to" button and an add/delete toggle for a layer's source. Deleting
 * removes the layer first (`Source.delete()` is reference-counted and only
 * removes the source once no layer references it); the toggle tracks presence so
 * clicks can't stack duplicate sources or no-op on an already-deleted one. The
 * optional `credit` supplies the source's current attribution so it is removed
 * on delete and restored on re-add.
 */
function addSourceLifecycleButtons(
  view: ThreeView,
  folder: ReturnType<Pane["addFolder"]>,
  getLayer: () => Layer,
  getSource: () => Source,
  reAdd: () => void,
  flyTarget: () => FlyToTarget,
  credit?: () => AttributionItem | undefined,
) {
  folder
    .addButton({ title: "fly to" })
    .on("click", () => flyTo(view, flyTarget()));

  let present = true;
  const toggle = folder.addButton({ title: "delete source" });
  toggle.on("click", () => {
    if (present) {
      getLayer().delete();
      getSource().delete();
      const c = credit?.();
      if (c) view.attribution?.remove([c]);
      toggle.title = "add source";
    } else {
      reAdd();
      const c = credit?.();
      if (c) view.attribution?.add([c]);
      toggle.title = "delete source";
    }
    present = !present;
  });
}

export const run = async (view: ThreeView<DefaultDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  view.addLight<AmbientLightDesc>({
    ambient: {},
  });

  // Raster tiles drape onto terrain tiles, so a terrain layer must be present.
  view.addLayer({ type: "terrain", ellipsoid: {} });

  createRaster(view);
  createGeojson(view);
  createB3dm(view);
  createPnts(view);
  createMvt(view);

  // Credit the non-base layers (B3DM / PNTS / MVT sources).
  view.attribution?.add([
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauKakegawaCastle,
    MVT_DATASETS.plateauTokyoFirePrevention,
  ]);

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addPanel(view, pane);
  addDateControl(view, pane);
};

function addPanel(view: ThreeView, pane: Pane) {
  addRasterTileFolder(view, pane);
  addGeojsonLayerFolder(view, pane);
  addB3dmLayerFolder(view, pane);
  addPntsLayerFolder(view, pane);
  addMvtLayerFolder(view, pane);
}

function addRasterTileFolder(view: ThreeView, pane: Pane) {
  const tileParams = {
    rasterShow: true,
    rasterColor: 0xffffff,
    rasterOpacity: 1,
    rasterMaxZoom: 23,
    rasterMinZoom: 0,
    rasterTms: false,
    rasterShowBoundingBox: false,
    elevationMaxHeight: 1000,
    elevationMinHeight: 0,
    elevationLogarithmic: false,
    elevationLogBoundary: 1,
    elevationDecoder: "japanGSI",
  };

  const tileFolder = pane.addFolder({
    title: "Tile Layer",
    expanded: false,
  });

  // Partial source update. `Source.update` merges like the layer's `update`:
  // the engine keeps every source field we don't mention, so each control sends
  // ONLY its changed field (plus the required `type`/`url`). We also merge the
  // patch into `gTileSourceDesc` so a later delete + re-add recreates the
  // current config.
  const updateTileSource = (patch: Partial<typeof gTileSourceDesc>) => {
    Object.assign(gTileSourceDesc, patch);
    gTileSource.update({
      type: "raster-tile",
      url: gTileSourceDesc.url,
      ...patch,
    });
  };

  // Appearance updates need the layer's type + source so the layer can be
  // rebuilt from its source.
  const updateRaster = (patch: {
    show?: boolean;
    color?: Color;
    opacity?: number;
    showBoundingBox?: boolean;
  }) =>
    gTileLayer.update({
      type: "raster",
      source: gTileSource.id,
      raster: patch,
    });

  // Re-apply the current appearance after a delete + re-add. `createRaster`
  // already restores the source config (it reads `gTileSourceDesc`), so only the
  // layer appearance params need to be pushed back onto the fresh layer.
  const applyRaster = () =>
    updateRaster({
      show: tileParams.rasterShow,
      color: new Color().setHex(tileParams.rasterColor),
      opacity: tileParams.rasterOpacity,
      showBoundingBox: tileParams.rasterShowBoundingBox,
    });

  // Keep the credit in sync with the active base imagery.
  const attribution = view.attribution;
  let creditedRaster: keyof typeof TILE_DATASETS = "openstreetmap";
  attribution?.add([TILE_DATASETS.openstreetmap]);

  addSourceLifecycleButtons(
    view,
    tileFolder,
    () => gTileLayer,
    () => gTileSource,
    () => {
      createRaster(view);
      applyRaster();
    },
    () => RASTER_TARGET,
    () => TILE_DATASETS[creditedRaster],
  );

  const rasterFolder = tileFolder.addFolder({
    title: "Raster Tile",
    expanded: false,
  });

  // Source URL switch. The imagery URL is a source-level param, so it goes
  // through the source; the raster loader reads it live per tile request.
  const rasterUrlOptions = {
    OpenStreetMap: "openstreetmap",
    "GSI Standard": "gsiStd",
    "GSI Seamless Photo": "gsiSeamlessphoto",
    "EOX Sentinel-2": "eox",
  } as const;
  const rasterUrlParams = { source: "openstreetmap" };
  rasterFolder
    .addBinding(rasterUrlParams, "source", {
      label: "url",
      options: rasterUrlOptions,
    })
    .on("change", (v) => {
      const next = v.value as keyof typeof TILE_DATASETS;
      if (next === creditedRaster) return;
      updateTileSource({ url: TILE_DATASETS[next].url });
      attribution?.remove([TILE_DATASETS[creditedRaster]]);
      attribution?.add([TILE_DATASETS[next]]);
      creditedRaster = next;
    });

  rasterFolder
    .addBinding(tileParams, "rasterShow", { label: "show" })
    .on("change", (v) => updateRaster({ show: v.value }));

  rasterFolder
    .addBinding(tileParams, "rasterColor", {
      label: "color",
      color: { type: "int" },
    })
    .on("change", (v) => updateRaster({ color: new Color().setHex(v.value) }));

  rasterFolder
    .addBinding(tileParams, "rasterOpacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) => updateRaster({ opacity: v.value }));

  // zoom / tms are source-level params, so update them through the source. Each
  // sends only its own field — the engine preserves the URL and the other two.
  rasterFolder
    .addBinding(tileParams, "rasterMaxZoom", {
      label: "maxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => updateTileSource({ maxZoom: v.value }));

  rasterFolder
    .addBinding(tileParams, "rasterMinZoom", {
      label: "minZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => updateTileSource({ minZoom: v.value }));

  rasterFolder
    .addBinding(tileParams, "rasterTms", { label: "tms" })
    .on("change", (v) => updateTileSource({ tms: v.value }));

  rasterFolder
    .addBinding(tileParams, "rasterShowBoundingBox", {
      label: "showBoundingBox",
    })
    .on("change", (v) => updateRaster({ showBoundingBox: v.value }));
}

function addGeojsonLayerFolder(view: ThreeView, pane: Pane) {
  const geoParams = {
    show: true,
    color: 0xffffff,
    height: 1,
    extrudedHeight: 0,
    clampToGround: true,
    wireframe: false,
    opacity: 1,
    transparent: false,
    surfaceShow: true,
    outlineShow: false,
    outlineColor: 0xffffff,
    outlineWidth: 1,
  };

  const geoFolder = pane.addFolder({
    title: "GeoJSON Layer",
    expanded: false,
  });

  // Re-apply the current polygon appearance after a delete + re-add.
  // `createGeojson` restores the source (inline data vs. url), so only the layer
  // appearance params need to be pushed back onto the fresh layer.
  const applyGeojson = () =>
    gGeojsonLayer.update({
      polygon: {
        show: geoParams.show,
        color: new Color().setHex(geoParams.color),
        height: geoParams.height,
        extrudedHeight: geoParams.extrudedHeight,
        clampToGround: geoParams.clampToGround,
        wireframe: geoParams.wireframe,
        opacity: geoParams.opacity,
        transparent: geoParams.transparent,
        surfaceShow: geoParams.surfaceShow,
        outlineShow: geoParams.outlineShow,
        outlineColor: new Color().setHex(geoParams.outlineColor),
        outlineWidth: geoParams.outlineWidth,
      },
    });

  addSourceLifecycleButtons(
    view,
    geoFolder,
    () => gGeojsonLayer,
    () => gGeojsonSource,
    () => {
      createGeojson(view);
      applyGeojson();
    },
    () => (gGeojsonUsesWorld ? GEOJSON_WORLD_TARGET : GEOJSON_FUJI_TARGET),
  );

  // Source switch: inline `data` (a polygon near Mt. Fuji) vs. a fetched `url`
  // (world countries). Both render with the polygon appearance below.
  const geoSourceParams = { source: "fuji" };
  geoFolder
    .addBinding(geoSourceParams, "source", {
      label: "source",
      options: { "Fuji (inline data)": "fuji", "World (url)": "world" },
    })
    .on("change", (v) => {
      gGeojsonUsesWorld = v.value === "world";
      if (gGeojsonUsesWorld) {
        gGeojsonSource.update({ type: "geojson", url: "/globe.geojson" });
        flyTo(view, { lat: 20, lng: 0, distance: 25_000_000, pitch: -89 });
      } else {
        gGeojsonSource.update({ type: "geojson", data: FUJI_POLYGON });
        flyTo(view, { lat: 35.37, lng: 138.73, distance: 50_000, pitch: -55 });
      }
    });

  const polygonFolder = geoFolder.addFolder({
    title: "Polygon",
    expanded: false,
  });

  polygonFolder
    .addBinding(geoParams, "show", { label: "show" })
    .on("change", (v) => gGeojsonLayer.update({ polygon: { show: v.value } }));
  polygonFolder
    .addBinding(geoParams, "color", {
      label: "color",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gGeojsonLayer.update({
        polygon: { color: new Color().setHex(v.value) },
      }),
    );
  polygonFolder
    .addBinding(geoParams, "height", {
      label: "height",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { height: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "extrudedHeight", {
      label: "extrudedHeight",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { extrudedHeight: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "clampToGround", { label: "clampToGround" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { clampToGround: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "wireframe", { label: "wireframe" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { wireframe: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "opacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { opacity: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "transparent", { label: "transparent" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { transparent: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "surfaceShow", { label: "surfaceShow" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { surfaceShow: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "outlineShow", { label: "outlineShow" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { outlineShow: v.value } }),
    );
  polygonFolder
    .addBinding(geoParams, "outlineColor", {
      label: "outlineColor",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gGeojsonLayer.update({
        polygon: { outlineColor: new Color().setHex(v.value) },
      }),
    );
  polygonFolder
    .addBinding(geoParams, "outlineWidth", {
      label: "outlineWidth",
      min: 0,
      max: 10,
      step: 0.1,
    })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { outlineWidth: v.value } }),
    );
}

function addB3dmLayerFolder(view: ThreeView, pane: Pane) {
  const b3dmParams = {
    show: true,
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.1,
    maxSse: 16,
    castShadow: false,
    receiveShadow: false,
  };

  const b3dmFolder = pane.addFolder({
    title: "B3DM Layer",
    expanded: false,
  });

  // Re-apply the current model appearance after a delete + re-add. `createB3dm`
  // restores the source URL, so only the layer params need to be pushed back.
  const applyB3dm = () =>
    gB3dmLayer.update({
      model: {
        show: b3dmParams.show,
        color: new Color().setHex(b3dmParams.color),
        metalness: b3dmParams.metalness,
        roughness: b3dmParams.roughness,
        maxSse: b3dmParams.maxSse,
        castShadow: b3dmParams.castShadow,
        receiveShadow: b3dmParams.receiveShadow,
      },
    });

  let b3dmCredit: keyof typeof TILES_3D_DATASETS = "plateauChiyoda";
  addSourceLifecycleButtons(
    view,
    b3dmFolder,
    () => gB3dmLayer,
    () => gB3dmSource,
    () => {
      createB3dm(view);
      applyB3dm();
    },
    () => gB3dmTarget,
    () => TILES_3D_DATASETS[b3dmCredit],
  );

  // Source URL switch: each option is a PLATEAU 3D Tiles building tileset in a
  // different Tokyo ward, so switching flies the camera there.
  const b3dmSources: Record<string, { key: string; target: FlyToTarget }> = {
    Chiyoda: {
      key: "plateauChiyoda",
      target: { lat: 35.6938, lng: 139.753, distance: 3000, pitch: -35 },
    },
    Shinjuku: {
      key: "plateauShinjuku",
      target: { lat: 35.6896, lng: 139.6917, distance: 3500, pitch: -35 },
    },
    Chuo: {
      key: "plateauChuo",
      target: { lat: 35.6706, lng: 139.772, distance: 3000, pitch: -35 },
    },
  };
  const b3dmSourceParams = { source: "Chiyoda" };
  b3dmFolder
    .addBinding(b3dmSourceParams, "source", {
      label: "url",
      options: { Chiyoda: "Chiyoda", Shinjuku: "Shinjuku", Chuo: "Chuo" },
    })
    .on("change", (v) => {
      const o = b3dmSources[v.value];
      const key = o.key as keyof typeof TILES_3D_DATASETS;
      gB3dmUrl = TILES_3D_DATASETS[key].url;
      gB3dmTarget = o.target;
      gB3dmSource.update({ type: "3d-tiles", url: gB3dmUrl });
      flyTo(view, gB3dmTarget);
      // Keep the credit in sync with the active B3DM source.
      if (key !== b3dmCredit) {
        view.attribution?.remove([TILES_3D_DATASETS[b3dmCredit]]);
        view.attribution?.add([TILES_3D_DATASETS[key]]);
        b3dmCredit = key;
      }
    });

  const modelFolder = b3dmFolder.addFolder({
    title: "Model",
    expanded: false,
  });
  modelFolder
    .addBinding(b3dmParams, "show", { label: "show" })
    .on("change", (v) => gB3dmLayer.update({ model: { show: v.value } }));
  modelFolder
    .addBinding(b3dmParams, "color", {
      label: "color",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gB3dmLayer.update({
        model: { color: new Color().setHex(v.value) },
      }),
    );
  modelFolder
    .addBinding(b3dmParams, "metalness", {
      label: "metalness",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) => gB3dmLayer.update({ model: { metalness: v.value } }));
  modelFolder
    .addBinding(b3dmParams, "roughness", {
      label: "roughness",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) => gB3dmLayer.update({ model: { roughness: v.value } }));
  modelFolder
    .addBinding(b3dmParams, "maxSse", {
      label: "maxSse",
      min: 1,
      max: 64,
      step: 1,
    })
    .on("change", (v) => gB3dmLayer.update({ model: { maxSse: v.value } }));
  modelFolder
    .addBinding(b3dmParams, "castShadow", { label: "castShadow" })
    .on("change", (v) => gB3dmLayer.update({ model: { castShadow: v.value } }));
  modelFolder
    .addBinding(b3dmParams, "receiveShadow", { label: "receiveShadow" })
    .on("change", (v) =>
      gB3dmLayer.update({ model: { receiveShadow: v.value } }),
    );
}

function addPntsLayerFolder(view: ThreeView, pane: Pane) {
  const pntsParams = {
    show: true,
    pointSize: 0.3,
    height: 0,
    maxSse: 16,
  };

  const pntsFolder = pane.addFolder({
    title: "PNTS Layer",
    expanded: false,
  });

  // Re-apply the current model appearance after a delete + re-add. `createPnts`
  // restores the source URL, so only the layer params need to be pushed back.
  const applyPnts = () =>
    gPntsLayer.update({
      model: {
        show: pntsParams.show,
        pointSize: pntsParams.pointSize,
        height: pntsParams.height,
        maxSse: pntsParams.maxSse,
      },
    });

  let pntsCredit: keyof typeof TILES_3D_DATASETS = "plateauKakegawaCastle";
  addSourceLifecycleButtons(
    view,
    pntsFolder,
    () => gPntsLayer,
    () => gPntsSource,
    () => {
      createPnts(view);
      applyPnts();
    },
    () => gPntsTarget,
    () => TILES_3D_DATASETS[pntsCredit],
  );

  // Source URL switch between two PLATEAU point-cloud tilesets.
  const pntsSources: Record<string, { key: string; target: FlyToTarget }> = {
    "Kakegawa Castle": {
      key: "plateauKakegawaCastle",
      target: { lat: 34.7735, lng: 138.0164, distance: 500, pitch: -30 },
    },
    "Yamanashi Kyonaka": {
      key: "YamanashiKyonaka",
      target: { lat: 35.6636, lng: 138.5686, distance: 3000, pitch: -40 },
    },
  };
  const pntsSourceParams = { source: "Kakegawa Castle" };
  pntsFolder
    .addBinding(pntsSourceParams, "source", {
      label: "url",
      options: {
        "Kakegawa Castle": "Kakegawa Castle",
        "Yamanashi Kyonaka": "Yamanashi Kyonaka",
      },
    })
    .on("change", (v) => {
      const o = pntsSources[v.value];
      const key = o.key as keyof typeof TILES_3D_DATASETS;
      gPntsUrl = TILES_3D_DATASETS[key].url;
      gPntsTarget = o.target;
      gPntsSource.update({ type: "3d-tiles", url: gPntsUrl });
      flyTo(view, gPntsTarget);
      // Keep the credit in sync with the active PNTS source.
      if (key !== pntsCredit) {
        view.attribution?.remove([TILES_3D_DATASETS[pntsCredit]]);
        view.attribution?.add([TILES_3D_DATASETS[key]]);
        pntsCredit = key;
      }
    });

  const modelFolder = pntsFolder.addFolder({
    title: "Model",
    expanded: false,
  });
  modelFolder
    .addBinding(pntsParams, "show", { label: "show" })
    .on("change", (v) => gPntsLayer.update({ model: { show: v.value } }));
  modelFolder
    .addBinding(pntsParams, "pointSize", {
      label: "pointSize",
      min: 0.01,
      max: 10,
      step: 0.01,
    })
    .on("change", (v) => gPntsLayer.update({ model: { pointSize: v.value } }));
  modelFolder
    .addBinding(pntsParams, "height", {
      label: "height",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) => gPntsLayer.update({ model: { height: v.value } }));
  modelFolder
    .addBinding(pntsParams, "maxSse", {
      label: "maxSse",
      min: 1,
      max: 64,
      step: 1,
    })
    .on("change", (v) => gPntsLayer.update({ model: { maxSse: v.value } }));
}

function addMvtLayerFolder(view: ThreeView, pane: Pane) {
  const mvtParams = {
    show: true,
    color: 0xff6600,
    extrudedHeight: 0,
    clampToGround: true,
    wireframe: false,
    // Polygon `opacity` only takes effect when `transparent` is enabled.
    transparent: false,
    opacity: 1,
  };

  const mvtFolder = pane.addFolder({
    title: "MVT Layer",
    expanded: false,
  });

  // Re-apply the current polygon appearance after a delete + re-add. `createMvt`
  // restores the source (URL + source-layer) from `gMvtOption`, so only the
  // layer appearance params need to be pushed back onto the fresh layer.
  const applyMvt = () =>
    gMvtLayer.update({
      polygon: {
        show: mvtParams.show,
        color: new Color().setHex(mvtParams.color),
        extrudedHeight: mvtParams.extrudedHeight,
        clampToGround: mvtParams.clampToGround,
        wireframe: mvtParams.wireframe,
        transparent: mvtParams.transparent,
        opacity: mvtParams.opacity,
      },
    });

  addSourceLifecycleButtons(
    view,
    mvtFolder,
    () => gMvtLayer,
    () => gMvtSource,
    () => {
      createMvt(view);
      applyMvt();
    },
    () => gMvtOption.target,
    () => MVT_DATASETS.plateauTokyoFirePrevention,
  );

  // Source URL switch. Each PLATEAU MVT dataset stores its polygons under a
  // different source-layer name, so switching the URL must also update
  // `sourceLayers` (and here the polygon color).
  const mvtSourceParams = { source: "Tokyo Fire Prevention District" };
  mvtFolder
    .addBinding(mvtSourceParams, "source", {
      label: "url",
      options: {
        "Tokyo Fire District": "Tokyo Fire Prevention District",
        "Tokyo Height District": "Tokyo Height Control District",
      },
    })
    .on("change", (v) => {
      gMvtOption = MVT_OPTIONS[v.value];
      // Update the layer's source layer first (so the stored layer description
      // is current), then update the source URL — the vector loader rebuilds
      // the layer against the new source and source-layer filter.
      gMvtLayer.update(mvtLayerConfig(gMvtSource.id, gMvtOption));
      mvtParams.color = gMvtOption.color;
      mvtFolder.refresh();
      // Partial source update: only the URL changes; `maxZoom` set at creation
      // is preserved by the engine.
      gMvtSource.update({ type: "vector-tile", url: gMvtOption.url });
      flyTo(view, gMvtOption.target);
    });

  const polygonFolder = mvtFolder.addFolder({
    title: "Polygon",
    expanded: false,
  });

  polygonFolder
    .addBinding(mvtParams, "show", { label: "show" })
    .on("change", (v) => gMvtLayer.update({ polygon: { show: v.value } }));

  polygonFolder
    .addBinding(mvtParams, "color", { label: "color", color: { type: "int" } })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { color: new Color().setHex(v.value) } }),
    );

  polygonFolder
    .addBinding(mvtParams, "extrudedHeight", {
      label: "extrudedHeight",
      min: 0,
      max: 500,
      step: 1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { extrudedHeight: v.value } }),
    );

  polygonFolder
    .addBinding(mvtParams, "clampToGround", { label: "clampToGround" })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { clampToGround: v.value } }),
    );

  polygonFolder
    .addBinding(mvtParams, "wireframe", { label: "wireframe" })
    .on("change", (v) => gMvtLayer.update({ polygon: { wireframe: v.value } }));

  // `opacity` needs `transparent` enabled to take visible effect.
  polygonFolder
    .addBinding(mvtParams, "transparent", { label: "transparent" })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { transparent: v.value } }),
    );

  polygonFolder
    .addBinding(mvtParams, "opacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) => gMvtLayer.update({ polygon: { opacity: v.value } }));
}
