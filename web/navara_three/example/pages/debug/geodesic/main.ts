import ThreeView, { Color } from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

const view = new ThreeView<DefaultDescriptions>({});
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

view.addLight({ ambient: { intensity: 1 } });

const basemap = view.addSource({
  type: "raster-tile",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: basemap });

view.setCamera({
  lng: 145,
  lat: 30,
  height: 5_200_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const polylineSource = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [120, 45],
            [170, 45],
          ],
        },
      },
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [139.7, 35.7],
            [-122.4, 37.8],
          ],
        },
      },
    ],
  },
});

const polygonSource = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [120, 5],
              [170, 5],
              [170, 30],
              [120, 30],
              [120, 5],
            ],
          ],
        },
      },
    ],
  },
});

const COLOR_3D = "#ff3b30";
const COLOR_DRAPED = "#0091ff";

const polylineLayer = (clampToGround: boolean) =>
  view.addLayer({
    type: "vector",
    source: polylineSource,
    polyline: {
      show: true,
      color: new Color().setStyle(clampToGround ? COLOR_DRAPED : COLOR_3D),
      width: 4,
      maxWidth: 100000,
      height: 1,
      clampToGround,
    },
  });

const polygonLayer = (clampToGround: boolean) =>
  view.addLayer({
    type: "vector",
    source: polygonSource,
    polygon: {
      color: new Color().setStyle(clampToGround ? COLOR_DRAPED : COLOR_3D),
      height: 1000,
      extrudedHeight: 0,
      clampToGround,
    },
  });

type Mode = "off" | "3d" | "draped" | "both";
const MODE_VARIANTS: Record<Mode, boolean[]> = {
  off: [],
  "3d": [false],
  draped: [true],
  both: [true, false],
};

type LayerHandle = ReturnType<typeof polylineLayer>;

const rebuild = (
  layers: LayerHandle[],
  build: (clampToGround: boolean) => LayerHandle,
  mode: Mode,
) => {
  for (const layer of layers) layer.delete();
  layers.length = 0;
  for (const clampToGround of MODE_VARIANTS[mode]) {
    layers.push(build(clampToGround));
  }
};

const polylineLayers: LayerHandle[] = [];
const polygonLayers: LayerHandle[] = [];

const PARAMS: { polyline: Mode; polygon: Mode } = {
  polyline: "both",
  polygon: "both",
};
rebuild(polylineLayers, polylineLayer, PARAMS.polyline);
rebuild(polygonLayers, polygonLayer, PARAMS.polygon);

const MODE_OPTIONS = {
  Off: "off",
  "3D (red)": "3d",
  "Draped (blue)": "draped",
  Both: "both",
} as const;

const pane = new Pane({ title: "Geodesic: 3D vs draped" });
pane
  .addBinding(PARAMS, "polyline", { options: MODE_OPTIONS })
  .on("change", (ev) => rebuild(polylineLayers, polylineLayer, ev.value));
pane
  .addBinding(PARAMS, "polygon", { options: MODE_OPTIONS })
  .on("change", (ev) => rebuild(polygonLayers, polygonLayer, ev.value));
