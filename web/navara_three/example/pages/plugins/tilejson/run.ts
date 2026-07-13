import ThreeView from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AttributionPlugin, TileJsonPlugin } from "@navara/three_plugins";

export type CustomDescriptions = DefaultDescriptions;

// A worldwide light-cartographic raster basemap published as TileJSON 3.0.0
// (raster `.png` tiles rendered from OpenStreetMap via Protomaps).
const TILEJSON_URL = "https://papers.reearth.land/styles/light/tilejson.json";

export async function run() {
  const view = new ThreeView<CustomDescriptions>({});

  view.addPlugin(new DefaultPlugin());

  // TileJsonPlugin surfaces each document's `attribution` through this plugin.
  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);
  const tilejson = new TileJsonPlugin({ attribution });
  view.addPlugin(tilejson);

  await view.init();

  // Even, un-tinted lighting suits a flat cartographic basemap (no sun/shadows).
  view.addLight({ ambient: {} });
  view.toneMappingExposure = 3;

  // Fetch the TileJSON and register it as a raster source. The document's
  // `minzoom`/`maxzoom` are forwarded to the source, and its `attribution` is
  // shown by the AttributionPlugin.
  const source = await tilejson.addSource({
    type: "raster-tile",
    id: "papers-light",
    url: TILEJSON_URL,
  });
  view.addLayer({ type: "raster", source });

  // Top-down over Japan at a country scale so the basemap fills the view.
  view.setCamera({
    lng: 138.0,
    lat: 37.0,
    height: 2_500_000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });
}
