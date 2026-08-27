import ThreeView, {
  Color,
  vector3ToGeodetic,
  type PickedFeature,
} from "@navaramap/three";
import { OverlayPlugin, TileJsonPlugin } from "@navaramap/three-plugins";
import { Vector3 } from "three";

import { initializeExample } from "../../../../helpers/initialize";

import { createInfoPanel } from "./panel";

const BASE = new Color().setStyle("#0091ff");
// Slightly brightened BASE, applied while a feature is hovered.
const HOVER = new Color().setStyle("#4db3ff");
const HIGHLIGHT = new Color().setStyle("#ff6b2c");

const view = new ThreeView({
  backgroundColor: new Color().setStyle("#cccccc"),
});

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

const overlay = new OverlayPlugin({ maxDistance: 20_000_000 });
view.addPlugin(overlay);

await view.init();

view.setCamera({
  lng: -0.1235,
  lat: 51.5075,
  height: 34_000,
  heading: 0,
  pitch: -84,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const places = await tilejson.addSource({
  type: "vector-tile",
  url: "https://papers.reearth.land/protomaps/tilejson.json",
});
const placesLayer = view.addLayer({
  type: "vector",
  source: places,
  sourceLayers: ["places"],
  point: {
    size: 12,
    sizeInMeters: false,
    color: BASE,
  },
});

const featureKey = (
  properties: Record<string, unknown> | undefined,
): string | null => {
  const name = properties?.["name"];
  if (name == null) return null;
  return [name, properties?.["kind"], properties?.["kind_detail"]].join("-");
};

let selectedKey: string | null = null;
let hoveredKey: string | null = null;

placesLayer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(
    ({ properties }) => {
      const key = featureKey(properties);
      return {
        color:
          key === selectedKey ? HIGHLIGHT : key === hoveredKey ? HOVER : BASE,
      };
    },
    { filters: ["name", "kind", "kind_detail"] },
  );
});

view.on("featureHover", (info) => {
  const key = info ? featureKey(info.properties) : null;
  if (key === hoveredKey) return;
  hoveredKey = key;
  view.canvas.style.cursor = key ? "pointer" : "";
  placesLayer.forceUpdate();
});

const panel = createInfoPanel();

let lastPick: PickedFeature | null | undefined = null;
view.on("featureClick", (info) => {
  lastPick = info;
});

let downX = 0;
let downY = 0;
view.on("mousedown", (event) => {
  downX = event.clientX;
  downY = event.clientY;
});

view.on("click", (event) => {
  if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) return;
  const previous = selectedKey;

  if (lastPick?.properties && featureKey(lastPick.properties) != null) {
    selectedKey = featureKey(lastPick.properties);
    const { lat, lng } = vector3ToGeodetic(
      new Vector3(event.map.x, event.map.y, event.map.z),
    );
    const lngLat = { lng, lat };
    panel.show(lastPick.properties, lngLat);
    overlay.setPositions([{ id: "picked", ...lngLat, alt: 0 }]);
  } else {
    selectedKey = null;
    panel.hide();
    overlay.setPositions([]);
  }

  if (previous !== selectedKey) placesLayer.forceUpdate();
});

overlay.onUpdate(({ projected }) => {
  const pos = projected.get("picked");
  if (pos) panel.moveTo(pos.x, pos.y);
  else panel.conceal();
});

view.attribution?.add([
  {
    attribution: "© OpenStreetMap contributors, © Protomaps",
    attributionUrl: "https://protomaps.com",
  },
]);

initializeExample(view);
