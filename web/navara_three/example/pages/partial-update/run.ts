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
      data: {
        url: TILES_3D_DATASETS.plateauChiyodaB3DM,
      },
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

  addCameraControl(view, pane);
  addPanel(view, pane);
};

function addPanel(_view: ThreeView, pane: Pane) {
  addRasterTileFolder(pane);
}

function addRasterTileFolder(pane: Pane) {
  const tileParams = {
    dataset: TILE_DATASETS.openstreetmap.url,
    dataUrl: TILE_DATASETS.openstreetmap.url,
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

  const getElevationDecoder = () => {
    switch (tileParams.elevationDecoder) {
      case "mapbox":
        return MAPBOX_ELEVATION_DECODER();
      case "terrarium":
        return TERRARIUM_ELEVATION_DECODER();
      case "japanGSI":
      default:
        return JAPAN_GSI_ELEVATION_DECODER();
    }
  };

  const updateElevationHeatmap = () => {
    gTileLayer.update({
      elevationHeatmap: {
        maxHeight: tileParams.elevationMaxHeight,
        minHeight: tileParams.elevationMinHeight,
        elevationDecoder: getElevationDecoder(),
        logarithmic: tileParams.elevationLogarithmic,
        logBoundary: tileParams.elevationLogBoundary,
      },
    });
  };

  const dataFolder = tileFolder.addFolder({ title: "Data", expanded: false });
  const urlBinding = dataFolder.addBinding(tileParams, "dataUrl", { label: "url", });

  urlBinding.on("change", (v) => {
    gTileLayer.update({ data: { url: v.value } });
  });

  dataFolder
    .addBinding(tileParams, "dataset", {
      options: Object.fromEntries(
        Object.entries(TILE_DATASETS).map(([key, value]) => [key, value.url]),
      ),
    })
    .on("change", (v) => {
      tileParams.dataUrl = v.value;
      urlBinding.refresh();
      gTileLayer.update({ data: { url: tileParams.dataUrl } });
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

  const elevationFolder = tileFolder.addFolder({
    title: "Elevation Heatmap",
    expanded: false,
  });
  elevationFolder
    .addBinding(tileParams, "elevationDecoder", {
      label: "decoder",
      options: {
        japanGSI: "japanGSI",
        mapbox: "mapbox",
        terrarium: "terrarium",
      },
    })
    .on("change", updateElevationHeatmap);
  elevationFolder
    .addBinding(tileParams, "elevationMaxHeight", {
      label: "maxHeight",
      min: 0,
      max: 10000,
      step: 1,
    })
    .on("change", updateElevationHeatmap);
  elevationFolder
    .addBinding(tileParams, "elevationMinHeight", {
      label: "minHeight",
      min: -1000,
      max: 10000,
      step: 1,
    })
    .on("change", updateElevationHeatmap);
  elevationFolder
    .addBinding(tileParams, "elevationLogarithmic", {
      label: "logarithmic",
    })
    .on("change", updateElevationHeatmap);
  elevationFolder
    .addBinding(tileParams, "elevationLogBoundary", {
      label: "logBoundary",
      min: 0,
      step: 0.1,
    })
    .on("change", updateElevationHeatmap);
}
