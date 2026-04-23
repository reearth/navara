import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
  MVT_DATASETS,
  GEOJSON_DATASETS,
  FONT_DATASETS,
} from "../../../helpers/constants";
import { addDateControl, addCameraControl } from "../../../helpers/control";
import { addCtrlPanel, type MaterialDesc } from "../../../helpers/panel";

export type CustomDescriptions = DefaultDescriptions;

const geoLayersDef: MaterialDesc[] = [
  {
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 23,
      opacity: 1,
    },
  },
  {
    type: "geojson",
    data: {
      url: GEOJSON_DATASETS.calderdaleDefibrillators.url,
    },
    point: {
      color: new Color().setStyle("#ff00ff"),
      size: 70.0,
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      transparent: false,
      depthTest: true,
      offsetDepth: true,
    },
  },
  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.70513431449842, 35.69279782617761],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [140.13033810546995, 35.60447056434825],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.64591330307843, 35.85950281451436],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.63564871528018, 35.44128807202607],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.28453080888477, 35.51560883529815],
            type: "Point",
          },
        },
      ],
    },
    point: {
      color: new Color().setStyle("#ffffff"),
      size: 70.0,
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      transparent: false,
      depthTest: true,
      offsetDepth: true,
      center: { x: 0.0, y: 0.0 },
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.73470764482283, 35.3627947204036],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.7311922738062, 35.359766379480206],
            type: "Point",
          },
        },
      ],
    },
    billboard: {
      color: new Color().setStyle("#ffffff"),
      size: 70.0,
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
      transparent: true,
      url: "/example.png",
      offsetDepth: true,
      center: { x: 0.0, y: -0.5 },
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [135.7672689034169, 35.011034421881675],
            type: "Point",
          },
        },
      ],
    },
    text: {
      color: new Color().setStyle("#ffffff"),
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
      text: "hello 京都",
      font: FONT_DATASETS.LineSeedJP.url,
      backgroundColor: new Color().setStyle("#0a70c2"),
      borderColor: new Color().setStyle("#f8e43c"),
      borderWidth: 0.08, // 0 ~ 0.5, the ratio of the border to the height
      // cornerRadius: 0.1, // 0 ~ 0.5, the ratio of the corner radius to the height
      size: 50,
      center: {
        x: 0.5,
        y: 0,
      },
      // padding: {
      //   x: 10,
      //   y: 0,
      // },
      offsetDepth: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [80, 10.0],
            type: "Point",
          },
        },
      ],
    },
    text: {
      color: new Color().setStyle("#ffffff"),
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
      text: "hello world!!!",
      font: FONT_DATASETS.Borel.url,
      backgroundColor: new Color().setStyle("#0a70c2"),
      borderColor: new Color().setStyle("#f8e43c"),
      borderWidth: 0.08, // 0 ~ 0.5, the ratio of the border to the height
      // cornerRadius: 0.1, // 0 ~ 0.5, the ratio of the corner radius to the height
      size: 50,
      center: {
        x: 0.5,
        y: 0,
      },
      // padding: {
      //   x: 10,
      //   y: 0,
      // },
      // outlineBlur: 0, // px
      outlineColor: new Color().setStyle("#000000"),
      // outlineOffset: { x: 4, y: 0 }, // px
      outlineOpacity: 1.0,
      outlineWidth: 4, // px
      offsetDepth: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [86.925, 27.9881],
            type: "Point",
          },
        },
      ],
    },
    text: {
      color: new Color().setStyle("#000000"),
      height: 1,
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
      text: "Mt.Everest",
      font: FONT_DATASETS.SourceCodePro.url,
      backgroundColor: new Color().setStyle("#a4e996"),
      borderColor: new Color().setStyle("#4aac3b"),
      borderWidth: 0.1, // 0 ~ 0.5, the ratio of the border to the height
      // cornerRadius: 0.1, // 0 ~ 0.5, the ratio of the corner radius to the height
      size: 30,
      // padding: {
      //   x: 5,
      //   y: 0,
      // },
      offsetDepth: false,
    },
  },

  {
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
      show: true,
      color: new Color().setStyle("#ff0000"),
      width: 2,
      maxWidth: 10000,
      height: 1,
      clampToGround: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [70.07775498388432, 51.60988186114207],
          [162.91882196095776, 28.580939466061338],
        ],
        type: "LineString",
      },
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#00ff00"),
      width: 5,
      maxWidth: 10000,
      height: 1,
      clampToGround: true,
    },
  },
  {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {
        id: "1",
      },
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
          [
            [138.75848857087954, 35.327942674501244],
            [138.75848857087954, 35.30705741002396],
            [138.7099676960035, 35.30705741002396],
            [138.75848857087954, 35.327942674501244],
          ],
          [
            [138.69753667745107, 35.422992283445495],
            [138.720671486169, 35.422992283445495],
            [138.720671486169, 35.400362713394486],
            [138.69753667745107, 35.400362713394486],
            [138.69753667745107, 35.422992283445495],
          ],
          [
            [138.7586738667644, 35.412062776959175],
            [138.78255935881282, 35.412062776959175],
            [138.78255935881282, 35.39057755353295],
            [138.7586738667644, 35.39057755353295],
            [138.7586738667644, 35.412062776959175],
          ],
          [
            [138.7211460206937, 35.370481559123604],
            [138.7388966476277, 35.370481559123604],
            [138.7388966476277, 35.35731998796588],
            [138.7211460206937, 35.35731998796588],
            [138.7211460206937, 35.370481559123604],
          ],
        ],
        type: "Polygon",
      },
    },
    polygon: {
      color: new Color().setStyle("#00aaff"),
      height: 0,
      extrudedHeight: 5000,
      clampToGround: true,
      wireframe: false,
      outlineColor: new Color().setStyle("#00ff00"),
      outlineWidth: 3,
      outline: true,
      outlineShow: false,
      surfaceShow: true,
      castShadow: true,
      receiveShadow: true,
    },
  },
  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [
              [
                [138.71772338768102, 35.26617067089579, 1000],
                [138.71801975668666, 35.34440682132805, 3000],
                [138.75446639853095, 35.34440682132805, 3000],
                [138.75356722301342, 35.26617067089579, 1000],
                [138.71772338768102, 35.26617067089579, 1000],
              ],
            ],
            type: "Polygon",
          },
        },
      ],
    },
    polygon: {
      color: new Color().setStyle("#ffaa00"),
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
      wireframe: false,
      outlineColor: new Color().setStyle("#aaff00"),
      outlineWidth: 3,
      outline: true,
      outlineShow: false,
      surfaceShow: true,
      castShadow: true,
      receiveShadow: true,
      perPositionHeight: true,
    },
  },
  {
    type: "b3dm",
    data: {
      url: TILES_3D_DATASETS.plateauChiyodaB3DM,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
    },
  },
  {
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
  },
  {
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChuo.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
  },
  {
    type: "mvt",
    data: {
      url: MVT_DATASETS.plateauWakayamaGen.url,
    },
    point: {
      color: new Color().setStyle("#ff0000"),
      size: 70.0,
      height: 1,
      // TODO: This should be abstracted like top-left/center/right, bottom-left/center/right
      center: {
        x: 0.0,
        y: 0.0,
      },
      sizeInMeters: false,
      clampToGround: true,
      depthTest: true,
    },
    vectorTile: {
      maxZoom: 16,
    },
  },
  {
    type: "mvt",
    data: {
      url: MVT_DATASETS.plateauGifuTran.url,
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#00ff00"),
      width: 2,
      maxWidth: 10000,
      height: 1,
      clampToGround: true,
    },
    vectorTile: {
      maxZoom: 16,
    },
  },
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
      wireframe: false,
    },
    vectorTile: {
      maxZoom: 15,
      layers: ["HeightControlDistrict"],
    },
  },
  {
    // Test RTE polyline
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [139.751163762, 35.687114441],
          [139.751182224, 35.687136426],
          [139.751162803, 35.687163336],
          [139.75120476, 35.687157594],
          [139.75122795, 35.687183842],
          [139.751231487, 35.687149816],
          [139.7512637, 35.6871450481],
          [139.751220093, 35.687126052],
          [139.751206672, 35.687090215],
          [139.751191521, 35.687120873],
          [139.75116, 35.68711],
        ],
        type: "LineString",
      },
    },
    polyline: {
      show: true,
      color: new Color().setStyle("#ff0000"),
      width: 5,
      maxWidth: 10000,
      height: 1,
      clampToGround: true,
    },
  },
];

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  const defaultAtmospheres = plugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 1,
      castShadow: true,
    },
  });

  view.addMesh({
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  // For debug
  // view.addLayer({
  //   type: "tiles",
  //   color: 0xffffff,
  //   segments: 10,
  //   height: 0,
  //   tile_url: "http://localhost:8888/{z}/{x}/{y}.png",
  //   z: 4,
  //   maxZoom: 21,
  //   wireframe: false,
  // });

  const terrainType: "mapbox" | "gsi" = "gsi";

  view.addLayer({
    type: "terrain",
    data: {
      url:
        // @ts-expect-error : Make switch button later
        terrainType === "mapbox"
          ? TERRAIN_DATASETS.mapbox.url
          : TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder:
        // @ts-expect-error : Make switch button later
        terrainType === "mapbox"
          ? MAPBOX_ELEVATION_DECODER()
          : JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.position = "absolute";
  pane.element.style.width = "340px";
  pane.element.style.right = "0px";

  addCameraControl(view, pane);
  addDateControl(view, pane);

  const materialCtrl = pane.addFolder({ title: "material" });

  addCtrlPanel(geoLayersDef, view, materialCtrl as Pane);

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.openstreetmap,
    GEOJSON_DATASETS.calderdaleDefibrillators,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
    MVT_DATASETS.plateauWakayamaGen,
    MVT_DATASETS.plateauGifuTran,
    MVT_DATASETS.plateauTokyoHeightControl,
  ]);
};
