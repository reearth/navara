import ThreeView, {
  Color,
  EllipsoidGeodesic,
  fetchFontFamilyFromCss,
  geodeticToVector3,
  vector3ToGeodetic,
  type Layer,
  type MeshHandle,
  type Source,
} from "@navaramap/three";
import type {
  SphereMeshDesc,
  TubeMeshDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

type GeodeticPoint = { lat: number; lng: number; height: number };

const LONDON = { lng: -0.1276, lat: 51.5072 };
const NEW_YORK = { lng: -74.006, lat: 40.7128 };

const MARKER_RADIUS = 100_000;
const LINE_RADIUS = 40_000;

// WASM-backed API is usable only after init().
const toGeodetic = (point: { lng: number; lat: number }): GeodeticPoint => ({
  lat: point.lat,
  lng: point.lng,
  height: 0,
});

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.addLight({ ambient: { intensity: 1 } });

// Font for the distance label; glyph files load lazily as labels need them.
view.addFontFamily(
  await fetchFontFamilyFromCss(
    "Arsenal",
    "https://fonts.googleapis.com/css2?family=Arsenal:wght@700",
  ),
);

view.setCamera({
  lng: -38,
  lat: 49,
  height: 6_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-dark/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

let startMarker: MeshHandle<SphereMeshDesc> | undefined;
let endMarker: MeshHandle<SphereMeshDesc> | undefined;
let arc: MeshHandle<TubeMeshDesc> | undefined;
let labelSource: Source | undefined;
let labelLayer: Layer | undefined;

const clearMeasurement = () => {
  startMarker?.delete();
  endMarker?.delete();
  arc?.delete();
  labelLayer?.delete();
  labelSource?.delete();
  startMarker = endMarker = arc = labelLayer = labelSource = undefined;
};

const addMarker = (point: GeodeticPoint) =>
  view.addMesh<SphereMeshDesc>({
    sphere: {
      radius: MARKER_RADIUS,
      color: new Color().setStyle("#ff6b2c"),
      emissiveColor: new Color().setStyle("#ff6b2c"),
      emissiveIntensity: 0.35,
    },
    geodetic: {
      lng: point.lng,
      lat: point.lat,
    },
  });

const addLabel = (midpoint: GeodeticPoint, label: string) => {
  labelSource = view.addSource({
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { label },
          geometry: {
            type: "Point",
            coordinates: [midpoint.lng, midpoint.lat],
          },
        },
      ],
    },
  });
  labelLayer = view.addLayer({
    type: "vector",
    source: labelSource,
    text: {
      font: "Arsenal",
      color: new Color().setStyle("#ffffff"),
      size: 50,
      sizeInMeters: false,
      outlineColor: new Color().setStyle("#000000"),
      outlineWidth: 4,
      declutter: false,
    },
  });
  labelLayer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => ({ text: (properties?.["label"] as string) ?? "" }),
      { filters: ["label"] },
    );
  });
};

const measure = (start: GeodeticPoint, end: GeodeticPoint) => {
  // The shortest path between the two points on the WGS84 ellipsoid.
  const geodesic = new EllipsoidGeodesic(start, end);
  // Surface points every 1/128 of the path, following the globe's curvature.
  const line = geodesic.interpolatePoints(geodesic.distance / 128);
  arc = view.addMesh<TubeMeshDesc>({
    tube: {
      points: line.map(({ lat, lng }) =>
        geodeticToVector3({ lat, lng, height: LINE_RADIUS }),
      ),
      radius: LINE_RADIUS,
      tubularSegments: 256,
      radialSegments: 12,
      color: new Color().setStyle("#0091ff"),
    },
  });
  endMarker = addMarker(end);

  const km = Math.round(geodesic.distance / 1000).toLocaleString();
  addLabel(geodesic.interpolateDistance(geodesic.distance / 2), `${km} km`);

  geodesic.dispose();
};

let start: GeodeticPoint | undefined;
view.on("click", (event) => {
  const picked = view.pickTerrainPosition(event.clientX, event.clientY);
  if (!picked) return;
  const { lat, lng } = vector3ToGeodetic(picked);
  const point: GeodeticPoint = { lat, lng, height: 0 };
  if (!start) {
    start = point;
    clearMeasurement();
    startMarker = addMarker(point);
  } else {
    measure(start, point);
    start = undefined;
  }
  view.forceUpdate();
});

const initialStart = toGeodetic(LONDON);
startMarker = addMarker(initialStart);
measure(initialStart, toGeodetic(NEW_YORK));

initializeExample(view);
