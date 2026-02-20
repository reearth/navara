import ThreeView, { AmbientLightLayer, Color, Layer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
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

export const run = async (view: ThreeView) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: {
      castShadow: true,
    },
  });

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  gTileLayer = view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  gGeojsonLayer = view.addLayer({
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

  gB3dmLayer = view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChiyoda.url },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
    },
  });

  gPntsLayer = view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauKakegawaCastle.url },
    model: {
      show: true,
      pointSize: 0.3,
      height: 0,
      maxSse: 16,
    },
  });

  gMvtLayer = view.addLayer({
    type: "mvt",
    data: {
      url: MVT_DATASETS.plateauGifuTran.url,
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#00ff00"),
      width: 2,
      height: 1,
      clampToGround: true,
      useGroundNormals: true,
    },
    vectorTile: {
      maxZoom: 16,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCustomCameraControl(view, pane);
  addPanel(view, pane);
  addDateControl(view, pane);
};

function addCustomCameraControl(view: ThreeView, pane: Pane) {
  addCameraControl(view, pane);

  pane.addButton({ title: "Kakegawa castle view" }).on("click", () => {
    view.flyTo({
      lat: 34.7734947205,
      lng: 138.0163726807,
      height: 424.66,
      heading: 326.62109375,
      pitch: -56.2649879456,
      roll: 360.0,
    });
  });
}

function addPanel(_view: ThreeView, pane: Pane) {
  addRasterTileFolder(pane);
  addGeojsonLayerFolder(pane);
  addB3dmLayerFolder(pane);
  addPntsLayerFolder(pane);
  addMvtLayerFolder(pane);
}

function addRasterTileFolder(pane: Pane) {
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

  const rasterFolder = tileFolder.addFolder({
    title: "Raster Tile",
    expanded: false,
  });

  rasterFolder
    .addBinding(tileParams, "rasterShow", { label: "show" })
    .on("change", (v) => gTileLayer.update({ rasterTile: { show: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterColor", {
      label: "color",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gTileLayer.update({ rasterTile: { color: new Color().setHex(v.value) } }),
    );

  rasterFolder
    .addBinding(tileParams, "rasterOpacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) =>
      gTileLayer.update({ rasterTile: { opacity: v.value } }),
    );

  rasterFolder
    .addBinding(tileParams, "rasterMaxZoom", {
      label: "maxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) =>
      gTileLayer.update({ rasterTile: { maxZoom: v.value } }),
    );

  rasterFolder
    .addBinding(tileParams, "rasterMinZoom", {
      label: "minZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) =>
      gTileLayer.update({ rasterTile: { minZoom: v.value } }),
    );

  rasterFolder
    .addBinding(tileParams, "rasterTms", { label: "tms" })
    .on("change", (v) => gTileLayer.update({ rasterTile: { tms: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterShowBoundingBox", {
      label: "showBoundingBox",
    })
    .on("change", (v) =>
      gTileLayer.update({ rasterTile: { showBoundingBox: v.value } }),
    );
}

function addGeojsonLayerFolder(pane: Pane) {
  const geoParams = {
    show: true,
    color: 0xffffff,
    height: 1,
    extrudedHeight: 0,
    clampToGround: true,
    useGroundNormals: false,
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
    .addBinding(geoParams, "useGroundNormals", { label: "useGroundNormals" })
    .on("change", (v) =>
      gGeojsonLayer.update({ polygon: { useGroundNormals: v.value } }),
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

function addB3dmLayerFolder(pane: Pane) {
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

function addPntsLayerFolder(pane: Pane) {
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

function addMvtLayerFolder(pane: Pane) {
  const mvtParams = {
    Show: true,
    Color: 0x00ff00,
    Height: 1,
    Width: 2,
    ClampToGround: true,
    UseGroundNormals: true,
    CastShadow: true,
    ReceiveShadow: false,
  };

  const mvtFolder = pane.addFolder({
    title: "MVT Layer",
    expanded: false,
  });

  const PolylineFolder = mvtFolder.addFolder({
    title: "Polyline",
    expanded: false,
  });

  PolylineFolder.addBinding(mvtParams, "Show", { label: "show" }).on(
    "change",
    (v) =>
      gMvtLayer.update({
        vectorTile: { show: v.value },
        polyline: { show: v.value },
      }),
  );

  PolylineFolder.addBinding(mvtParams, "Color", {
    label: "color",
    color: { type: "int" },
  }).on("change", (v) =>
    gMvtLayer.update({
      polyline: { color: new Color().setHex(v.value) },
    }),
  );

  PolylineFolder.addBinding(mvtParams, "Height", {
    label: "height",
    min: -1000,
    max: 10000,
    step: 1,
  }).on("change", (v) => gMvtLayer.update({ polyline: { height: v.value } }));

  PolylineFolder.addBinding(mvtParams, "Width", {
    label: "width",
    min: -1000,
    max: 10000,
    step: 1,
  }).on("change", (v) => gMvtLayer.update({ polyline: { width: v.value } }));

  PolylineFolder.addBinding(mvtParams, "ClampToGround", {
    label: "clampToGround",
  }).on("change", (v) =>
    gMvtLayer.update({ polyline: { clampToGround: v.value } }),
  );

  PolylineFolder.addBinding(mvtParams, "UseGroundNormals", {
    label: "useGroundNormals",
  }).on("change", (v) =>
    gMvtLayer.update({ polyline: { useGroundNormals: v.value } }),
  );

  PolylineFolder.addBinding(mvtParams, "CastShadow", {
    label: "castShadow",
  }).on("change", (v) =>
    gMvtLayer.update({ polyline: { castShadow: v.value } }),
  );

  PolylineFolder.addBinding(mvtParams, "ReceiveShadow", {
    label: "receiveShadow",
  }).on("change", (v) =>
    gMvtLayer.update({ polyline: { receiveShadow: v.value } }),
  );
}
