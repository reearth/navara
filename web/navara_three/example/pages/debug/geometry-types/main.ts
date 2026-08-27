/**
 * Debug page for the vector-layer `geometryTypes` option.
 *
 * Exercises every derivation combination on both source kinds:
 * - GeoJSON (inline, mixed Point/MultiPoint/LineString/MultiLineString/
 *   Polygon-with-hole/MultiPolygon), on the direct path and, via
 *   `clampToGround`, on the tiled path.
 * - MVT (PLATEAU fire-prevention districts, polygon geometry).
 *
 * Every pane change rebuilds the layer from scratch (delete + addLayer), so
 * the parse-time derivation is re-evaluated for the new config.
 *
 * The `evaluate` check colors features per feature via `FeatureEvaluator`
 * (GeoJSON by `name`, MVT by `urf_function`). Derived representations carry
 * the source feature's properties, so a feature's boundary polylines and
 * derived points take the same evaluated color as its fill.
 *
 * Clicking any representation picks its source feature: the pane's `picking`
 * folder shows the picked properties key and batch id, and every
 * representation of that feature (fill, boundary polylines, derived points)
 * highlights, which verifies that picking a derived instance resolves to the
 * right feature.
 */
import ThreeView, {
  Color,
  type FeatureInfo,
  type LayerDescription,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import { MVT_DATASETS } from "../../../helpers/constants";

type SourceGeometryType = "point" | "line" | "polygon";

const view = new ThreeView<DefaultDescriptions>({ debug: true });
view.addPlugin(new DefaultPlugin());
await view.init();

// Non-clamped polylines render through a lit shader; without a light they
// draw black. An ambient light keeps every combination visible.
view.addLight({ ambient: { intensity: 1 } });

view.addLayer({ type: "terrain", ellipsoid: {} });
view.globe.color = new Color().setStyle("#12233a");

// ── Test data ───────────────────────────────────────────────────────────────

// A compact cluster of every GeoJSON geometry kind near Chiba, placed away
// from the PLATEAU Tokyo MVT districts so the two datasets never overlap.
const geojsonSource = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "point" },
        geometry: { type: "Point", coordinates: [140.1, 35.7] },
      },
      {
        type: "Feature",
        properties: { name: "multipoint" },
        geometry: {
          type: "MultiPoint",
          coordinates: [
            [140.103, 35.702],
            [140.106, 35.7],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "linestring" },
        geometry: {
          type: "LineString",
          coordinates: [
            [140.11, 35.695],
            [140.12, 35.7],
            [140.13, 35.694],
            [140.14, 35.7],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "multilinestring" },
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [
              [140.11, 35.688],
              [140.125, 35.69],
            ],
            [
              [140.13, 35.686],
              [140.14, 35.69],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "polygon-with-hole" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [140.1, 35.675],
              [140.12, 35.675],
              [140.12, 35.683],
              [140.1, 35.683],
              [140.1, 35.675],
            ],
            [
              [140.107, 35.677],
              [140.113, 35.677],
              [140.113, 35.681],
              [140.107, 35.681],
              [140.107, 35.677],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "multipolygon" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [140.125, 35.675],
                [140.132, 35.675],
                [140.132, 35.681],
                [140.125, 35.681],
                [140.125, 35.675],
              ],
            ],
            [
              [
                [140.136, 35.675],
                [140.143, 35.675],
                [140.143, 35.681],
                [140.136, 35.681],
                [140.136, 35.675],
              ],
            ],
          ],
        },
      },
    ],
  },
});

// Polygon-only MVT data to verify the worker parse path.
const mvtSource = view.addSource({
  type: "vector-tile",
  url: MVT_DATASETS.plateauTokyoFirePrevention.url,
  maxZoom: 16,
});

view.attribution?.add([
  {
    attribution: MVT_DATASETS.plateauTokyoFirePrevention.attribution,
    attributionUrl: MVT_DATASETS.plateauTokyoFirePrevention.attributionUrl,
  },
]);

// ── Pane state → layer descriptors ──────────────────────────────────────────

const state = {
  point: {
    enabled: true,
    fromPoint: true,
    fromLine: false,
    fromPolygon: false,
    size: 12,
    color: "#ffcc00",
  },
  polyline: {
    enabled: true,
    fromLine: true,
    fromPolygon: true,
    clampToGround: true,
    width: 3,
    color: "#ffffff",
  },
  polygon: {
    enabled: true,
    clampToGround: true,
    color: "#2d6a4f",
  },
  // Per-feature coloring via FeatureEvaluator; overrides the material colors.
  evaluate: false,
};

const geometryTypes = (m: {
  fromPoint?: boolean;
  fromLine: boolean;
  fromPolygon: boolean;
}): SourceGeometryType[] => [
  ...(m.fromPoint ? (["point"] as const) : []),
  ...(m.fromLine ? (["line"] as const) : []),
  ...(m.fromPolygon ? (["polygon"] as const) : []),
];

const buildMaterials = () => ({
  ...(state.point.enabled && {
    point: {
      color: new Color().setStyle(state.point.color),
      size: state.point.size,
      sizeInMeters: false,
      clampToGround: true,
      geometryTypes: geometryTypes(state.point),
    },
  }),
  ...(state.polyline.enabled && {
    polyline: {
      color: new Color().setStyle(state.polyline.color),
      width: state.polyline.width,
      maxWidth: 100_000,
      clampToGround: state.polyline.clampToGround,
      geometryTypes: geometryTypes(state.polyline),
    },
  }),
  ...(state.polygon.enabled && {
    polygon: {
      color: new Color().setStyle(state.polygon.color),
      clampToGround: state.polygon.clampToGround,
    },
  }),
});

const buildLayer = (source: typeof geojsonSource): LayerDescription => ({
  type: "vector",
  source,
  ...buildMaterials(),
});

// ── Feature evaluation ──────────────────────────────────────────────────────

// One color per GeoJSON feature, keyed by its `name` property. With the
// `evaluate` check on, every representation of a feature (fill, boundary
// polyline, derived points) shares the feature's color, which makes it easy
// to see that derived geometry carries the source feature's properties.
const GEOJSON_FEATURE_COLORS: Record<string, string> = {
  point: "#ff6b6b",
  multipoint: "#feca57",
  linestring: "#48dbfb",
  multilinestring: "#1dd1a1",
  "polygon-with-hole": "#a55eea",
  multipolygon: "#ff9ff3",
};

// PLATEAU fire-prevention districts, keyed by `urf_function`.
const MVT_FEATURE_COLORS: Record<string, string> = {
  防火地域: "#e74c3c",
  準防火地域: "#f39c12",
};

// ── Picking ─────────────────────────────────────────────────────────────────

// The picked feature's identity. GeoJSON features are keyed by `name` and MVT
// districts by `gml_id`; a feature without either falls back to the pick's
// canonical batch id, which the evaluator reports as `info.batchId`.
const picked = { key: "", batchId: -1, label: "(none)" };

const featureKey = (
  properties: Record<string, unknown> | undefined,
): string | undefined =>
  (properties?.["name"] ?? properties?.["gml_id"]) as string | undefined;

const isPickedFeature = (info: FeatureInfo): boolean => {
  if (picked.key !== "") return featureKey(info.properties) === picked.key;
  return picked.batchId >= 0 && info.batchId === picked.batchId;
};

view.on("pick", (info) => {
  const key = info ? featureKey(info.properties) : undefined;
  picked.key = key ?? "";
  picked.batchId = info?.batchId ?? -1;
  picked.label = info
    ? `${key ?? "(no key)"} batchId=${info.batchId}`
    : "(none)";
  geojsonLayer.forceUpdate();
  mvtLayer.forceUpdate();
});

const PICK_HIGHLIGHT = "#ff00ff";

// One evaluator per layer, always attached: it paints the picked feature's
// every representation in the highlight color, and the rest either in the
// per-feature palette (`evaluate` on) or back in its material color.
const materialColorFor = (meshGeomType: string | undefined): string => {
  if (meshGeomType === "point") return state.point.color;
  if (meshGeomType === "polyline") return state.polyline.color;
  return state.polygon.color;
};

const attachEvaluators = () => {
  geojsonLayer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      (info) => {
        if (isPickedFeature(info)) {
          return { color: new Color().setStyle(PICK_HIGHLIGHT) };
        }
        return {
          color: new Color().setStyle(
            state.evaluate
              ? (GEOJSON_FEATURE_COLORS[
                  (info.properties?.["name"] as string) ?? ""
                ] ?? "#ffffff")
              : materialColorFor(info.meshGeomType),
          ),
        };
      },
      { filters: ["name"] },
    );
  });
  mvtLayer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      (info) => {
        if (isPickedFeature(info)) {
          return { color: new Color().setStyle(PICK_HIGHLIGHT) };
        }
        return {
          color: new Color().setStyle(
            state.evaluate
              ? (MVT_FEATURE_COLORS[
                  (info.properties?.["urf_function"] as string) ?? ""
                ] ?? "#95a5a6")
              : materialColorFor(info.meshGeomType),
          ),
        };
      },
      { filters: ["urf_function", "gml_id"] },
    );
  });
};

let geojsonLayer = view.addLayer(buildLayer(geojsonSource));
let mvtLayer = view.addLayer(buildLayer(mvtSource));
attachEvaluators();

const rebuild = () => {
  geojsonLayer.delete();
  mvtLayer.delete();
  geojsonLayer = view.addLayer(buildLayer(geojsonSource));
  mvtLayer = view.addLayer(buildLayer(mvtSource));
  attachEvaluators();
};

// ── Pane ────────────────────────────────────────────────────────────────────

const pane = new Pane({ title: "geometryTypes" });

const pointFolder = pane.addFolder({ title: "point" });
pointFolder.addBinding(state.point, "enabled");
pointFolder.addBinding(state.point, "fromPoint");
pointFolder.addBinding(state.point, "fromLine");
pointFolder.addBinding(state.point, "fromPolygon");
pointFolder.addBinding(state.point, "size", { min: 2, max: 40, step: 1 });
pointFolder.addBinding(state.point, "color");

const polylineFolder = pane.addFolder({ title: "polyline" });
polylineFolder.addBinding(state.polyline, "enabled");
polylineFolder.addBinding(state.polyline, "fromLine");
polylineFolder.addBinding(state.polyline, "fromPolygon");
polylineFolder.addBinding(state.polyline, "clampToGround");
polylineFolder.addBinding(state.polyline, "width", {
  min: 1,
  max: 20,
  step: 1,
});
polylineFolder.addBinding(state.polyline, "color");

const polygonFolder = pane.addFolder({ title: "polygon" });
polygonFolder.addBinding(state.polygon, "enabled");
polygonFolder.addBinding(state.polygon, "clampToGround");
polygonFolder.addBinding(state.polygon, "color");

const evaluationFolder = pane.addFolder({ title: "feature evaluation" });
evaluationFolder.addBinding(state, "evaluate");

const pickingFolder = pane.addFolder({ title: "picking" });
const pickedBinding = pickingFolder.addBinding(picked, "label", {
  label: "picked",
  readonly: true,
  interval: 200,
});

// The readonly picked monitor must not rebuild the layers when it refreshes.
pane.on("change", (ev) => {
  if (ev.target !== pickedBinding) rebuild();
});

// Camera shortcuts for the two datasets.
const cameraFolder = pane.addFolder({ title: "camera" });
const GEOJSON_CAMERA = {
  lng: 140.12,
  lat: 35.66,
  height: 9_000,
  heading: 0,
  pitch: -60,
  roll: 0,
};
cameraFolder
  .addButton({ title: "GeoJSON cluster (Chiba)" })
  .on("click", () => view.setCamera(GEOJSON_CAMERA));
cameraFolder.addButton({ title: "MVT districts (Tokyo)" }).on("click", () =>
  view.setCamera({
    lng: 139.75,
    lat: 35.6,
    height: 30_000,
    heading: 0,
    pitch: -70,
    roll: 0,
  }),
);

view.setCamera(GEOJSON_CAMERA);
