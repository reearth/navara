import ThreeView, {
  AmbientLightLayer,
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  Layer,
  MAPBOX_ELEVATION_DECODER,
  TERRARIUM_ELEVATION_DECODER,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, TERRAIN_DATASETS, TILES_3D_DATASETS, MVT_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gTileLayer: Layer;
let gTerrainLayer: Layer;
let gGeojsonLayer: Layer;
let gB3dmLayer: Layer;
let gPntsLayer: Layer;
let gMvtLayer: Layer;

export const run = async (view: ThreeView) => {
  await view.init();

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

  gTerrainLayer = view.addLayer({
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

  gB3dmLayer = view.addLayer(
    {
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

  gMvtLayer = view.addLayer(
    {
      type: "mvt",
      data: {
        url: MVT_DATASETS.plateauTokyoHeightControl.url,
      },
      polygon: {
        color: new Color().setStyle("#00aaff"),
        height: 10,
        extrudedHeight: 0,
        clampToGround: true,
        useGroundNormals: true,
        wireframe: false,
      },
      vectorTile: {
        maxZoom: 15,
        layers: ["HeightControlDistrict"],
      },
    });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCustomCameraControl(view, pane);
  addPanel(view, pane);
};


function addCustomCameraControl(view: ThreeView, pane: Pane) {
  addCameraControl(view, pane);
    
  pane.addButton({ title: "Kakegawa castle view" })
    .on("click", () => {
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
  addTerrainLayerFolder(pane);
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
    expanded: true,
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
    .on("change", (v) => gTileLayer.update({ rasterTile: { color: new Color().setHex(v.value) } }));

  rasterFolder
    .addBinding(tileParams, "rasterOpacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) => gTileLayer.update({ rasterTile: { opacity: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterMaxZoom", {
      label: "maxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => gTileLayer.update({ rasterTile: { maxZoom: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterMinZoom", {
      label: "minZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => gTileLayer.update({ rasterTile: { minZoom: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterTms", { label: "tms" })
    .on("change", (v) => gTileLayer.update({ rasterTile: { tms: v.value } }));

  rasterFolder
    .addBinding(tileParams, "rasterShowBoundingBox", {
      label: "showBoundingBox",
    })
    .on("change", (v) => gTileLayer.update({ rasterTile: { showBoundingBox: v.value } }));
}

function addTerrainLayerFolder(pane: Pane) {
  const terrainParams = {
    show: true,
    castShadow: true,
    receiveShadow: true,
    showBoundingBox: false,
    maxZoom: 15,
    minZoom: 6,
    overscaledMaxZoom: 24,
    tileSize: 256,
    skirt: true,
    skirtExaggeration: 1,
  };

  const terrainFolder = pane.addFolder({
    title: "Terrain Layer",
    expanded: false,
  });

  const updateRasterTerrain = (update: Record<string, unknown>) => {
    gTerrainLayer.update({ rasterTerrain: update });
  };

  const rasterFolder = terrainFolder.addFolder({
    title: "Raster Terrain",
    expanded: false,
  });
  rasterFolder
    .addBinding(terrainParams, "show", { label: "show" })
    .on("change", (v) => updateRasterTerrain({ show: v.value }));
  rasterFolder
    .addBinding(terrainParams, "castShadow", { label: "castShadow" })
    .on("change", (v) => updateRasterTerrain({ castShadow: v.value }));
  rasterFolder
    .addBinding(terrainParams, "receiveShadow", { label: "receiveShadow" })
    .on("change", (v) => updateRasterTerrain({ receiveShadow: v.value }));
  rasterFolder
    .addBinding(terrainParams, "showBoundingBox", {
      label: "showBoundingBox",
    })
    .on("change", (v) => updateRasterTerrain({ showBoundingBox: v.value }));
  rasterFolder
    .addBinding(terrainParams, "maxZoom", {
      label: "maxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => updateRasterTerrain({ maxZoom: v.value }));
  rasterFolder
    .addBinding(terrainParams, "minZoom", {
      label: "minZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => updateRasterTerrain({ minZoom: v.value }));
  rasterFolder
    .addBinding(terrainParams, "overscaledMaxZoom", {
      label: "overscaledMaxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) => updateRasterTerrain({ overscaledMaxZoom: v.value }));
  rasterFolder
    .addBinding(terrainParams, "tileSize", {
      label: "tileSize",
      min: 64,
      max: 512,
      step: 1,
    })
    .on("change", (v) => updateRasterTerrain({ tileSize: v.value }));
  rasterFolder
    .addBinding(terrainParams, "skirt", { label: "skirt" })
    .on("change", (v) => updateRasterTerrain({ skirt: v.value }));
  rasterFolder
    .addBinding(terrainParams, "skirtExaggeration", {
      label: "skirtExaggeration",
      min: 0,
      max: 5,
      step: 0.1,
    })
    .on("change", (v) => updateRasterTerrain({ skirtExaggeration: v.value }));
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
    dataset: TILES_3D_DATASETS.plateauChiyodaB3DM.url,
    dataUrl: TILES_3D_DATASETS.plateauChiyodaB3DM.url,
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

  const dataFolder = b3dmFolder.addFolder({ title: "Data", expanded: false });
  const urlBinding = dataFolder.addBinding(b3dmParams, "dataUrl", {
    label: "url",
  });
  urlBinding.on("change", (v) => {
    gB3dmLayer.update({ data: { url: v.value } });
  });
  dataFolder
    .addBinding(b3dmParams, "dataset", {
      options: Object.fromEntries(
        Object.entries(TILES_3D_DATASETS).map(([key, value]) => [
          key,
          value.url,
        ]),
      ),
    })
    .on("change", (v) => {
      b3dmParams.dataUrl = v.value;
      urlBinding.refresh();
      gB3dmLayer.update({ data: { url: b3dmParams.dataUrl } });
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
    .on("change", (v) =>
      gB3dmLayer.update({ model: { metalness: v.value } }),
    );
  modelFolder
    .addBinding(b3dmParams, "roughness", {
      label: "roughness",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) =>
      gB3dmLayer.update({ model: { roughness: v.value } }),
    );
  modelFolder
    .addBinding(b3dmParams, "maxSse", {
      label: "maxSse",
      min: 1,
      max: 64,
      step: 1,
    })
    .on("change", (v) =>
      gB3dmLayer.update({ model: { maxSse: v.value } }),
    );
  modelFolder
    .addBinding(b3dmParams, "castShadow", { label: "castShadow" })
    .on("change", (v) =>
      gB3dmLayer.update({ model: { castShadow: v.value } }),
    );
  modelFolder
    .addBinding(b3dmParams, "receiveShadow", { label: "receiveShadow" })
    .on("change", (v) =>
      gB3dmLayer.update({ model: { receiveShadow: v.value } }),
    );
}

function addPntsLayerFolder(pane: Pane) {
  const pntsParams = {
    dataset: TILES_3D_DATASETS.plateauKakegawaCastle.url,
    dataUrl: TILES_3D_DATASETS.plateauKakegawaCastle.url,
    show: true,
    pointSize: 0.3,
    height: 0,
    maxSse: 16,
  };

  const pntsFolder = pane.addFolder({
    title: "PNTS Layer",
    expanded: false,
  });

  const dataFolder = pntsFolder.addFolder({ title: "Data", expanded: false });
  const urlBinding = dataFolder.addBinding(pntsParams, "dataUrl", {
    label: "url",
  });
  urlBinding.on("change", (v) => {
    gPntsLayer.update({ data: { url: v.value } });
  });
  dataFolder
    .addBinding(pntsParams, "dataset", {
      options: Object.fromEntries(
        Object.entries(TILES_3D_DATASETS).map(([key, value]) => [
          key,
          value.url,
        ]),
      ),
    })
    .on("change", (v) => {
      pntsParams.dataUrl = v.value;
      urlBinding.refresh();
      gPntsLayer.update({ data: { url: pntsParams.dataUrl } });
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
    .on("change", (v) =>
      gPntsLayer.update({ model: { pointSize: v.value } }),
    );
  modelFolder
    .addBinding(pntsParams, "height", {
      label: "height",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) =>
      gPntsLayer.update({ model: { height: v.value } }),
    );
  modelFolder
    .addBinding(pntsParams, "maxSse", {
      label: "maxSse",
      min: 1,
      max: 64,
      step: 1,
    })
    .on("change", (v) =>
      gPntsLayer.update({ model: { maxSse: v.value } }),
    );
}

function addMvtLayerFolder(pane: Pane) {
  const mvtParams = {
    dataset: MVT_DATASETS.plateauTokyoHeightControl.url,
    dataUrl: MVT_DATASETS.plateauTokyoHeightControl.url,
    polygonShow: true,
    polygonColor: 0x00aaff,
    polygonHeight: 10,
    polygonExtrudedHeight: 0,
    polygonClampToGround: true,
    polygonUseGroundNormals: true,
    polygonWireframe: false,
    polygonOpacity: 1,
    polygonTransparent: false,
    polygonOutlineShow: false,
    polygonOutlineColor: 0xffffff,
    polygonOutlineWidth: 1,
    vectorShow: true,
    vectorMaxZoom: 15,
    vectorMaxSse: 2,
    vectorOverscaledMaxZoom: 24,
    vectorLayers: "HeightControlDistrict",
  };

  const mvtFolder = pane.addFolder({
    title: "MVT Layer",
    expanded: false,
  });

  const dataFolder = mvtFolder.addFolder({ title: "Data", expanded: false });
  const urlBinding = dataFolder.addBinding(mvtParams, "dataUrl", {
    label: "url",
  });
  urlBinding.on("change", (v) => {
    gMvtLayer.update({ data: { url: v.value } });
  });
  dataFolder
    .addBinding(mvtParams, "dataset", {
      options: Object.fromEntries(
        Object.entries(MVT_DATASETS).map(([key, value]) => [key, value.url]),
      ),
    })
    .on("change", (v) => {
      mvtParams.dataUrl = v.value;
      urlBinding.refresh();
      gMvtLayer.update({ data: { url: mvtParams.dataUrl } });
    });

  const polygonFolder = mvtFolder.addFolder({
    title: "Polygon",
    expanded: false,
  });
  polygonFolder
    .addBinding(mvtParams, "polygonShow", { label: "show" })
    .on("change", (v) => gMvtLayer.update({ polygon: { show: v.value } }));
  polygonFolder
    .addBinding(mvtParams, "polygonColor", {
      label: "color",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gMvtLayer.update({
        polygon: { color: new Color().setHex(v.value) },
      }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonHeight", {
      label: "height",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { height: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonExtrudedHeight", {
      label: "extrudedHeight",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { extrudedHeight: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonClampToGround", {
      label: "clampToGround",
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { clampToGround: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonUseGroundNormals", {
      label: "useGroundNormals",
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { useGroundNormals: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonWireframe", { label: "wireframe" })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { wireframe: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonOpacity", {
      label: "opacity",
      min: 0,
      max: 1,
      step: 0.01,
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { opacity: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonTransparent", { label: "transparent" })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { transparent: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonOutlineShow", { label: "outlineShow" })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { outlineShow: v.value } }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonOutlineColor", {
      label: "outlineColor",
      color: { type: "int" },
    })
    .on("change", (v) =>
      gMvtLayer.update({
        polygon: { outlineColor: new Color().setHex(v.value) },
      }),
    );
  polygonFolder
    .addBinding(mvtParams, "polygonOutlineWidth", {
      label: "outlineWidth",
      min: 0,
      max: 10,
      step: 0.1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ polygon: { outlineWidth: v.value } }),
    );

  const vectorFolder = mvtFolder.addFolder({
    title: "Vector Tile",
    expanded: false,
  });
  const parseLayers = (value: string) =>
    value
      .split(",")
      .map((layer) => layer.trim())
      .filter((layer) => layer.length > 0);
  vectorFolder
    .addBinding(mvtParams, "vectorShow", { label: "show" })
    .on("change", (v) => gMvtLayer.update({ vectorTile: { show: v.value } }));
  vectorFolder
    .addBinding(mvtParams, "vectorMaxZoom", {
      label: "maxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ vectorTile: { maxZoom: v.value } }),
    );
  vectorFolder
    .addBinding(mvtParams, "vectorMaxSse", {
      label: "maxSse",
      min: 0.5,
      max: 16,
      step: 0.5,
    })
    .on("change", (v) =>
      gMvtLayer.update({ vectorTile: { maxSse: v.value } }),
    );
  vectorFolder
    .addBinding(mvtParams, "vectorOverscaledMaxZoom", {
      label: "overscaledMaxZoom",
      min: 0,
      max: 30,
      step: 1,
    })
    .on("change", (v) =>
      gMvtLayer.update({ vectorTile: { overscaledMaxZoom: v.value } }),
    );
  vectorFolder
    .addBinding(mvtParams, "vectorLayers", { label: "layers" })
    .on("change", (v) =>
      gMvtLayer.update({ vectorTile: { layers: parseLayers(v.value) } }),
    );
}
