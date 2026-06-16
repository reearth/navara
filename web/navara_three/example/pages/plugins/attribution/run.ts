import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import {
  AttributionPlugin,
  type AttributionItem,
  type AttributionStyle,
} from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { datasetToSource } from "../../../helpers/attribution-source";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";
import { GOOGLE_MAPS_API_KEY } from "../../../helpers/keys";

import { GSI_ATTRIBUTION, SENTINEL_ATTRIBUTION } from "./data/attributions";

export type CustomDescriptions = DefaultDescriptions;

// Light / dark color sets for the setStyle() demo below. setStyle() merges, so
// LIGHT_STYLE just re-applies the defaults to switch back from dark.
const LIGHT_STYLE: AttributionStyle = {
  backgroundColor: "rgba(252, 253, 254, 0.96)",
  textColor: "#1b1f24",
  nestedTextColor: "rgba(27, 31, 36, 0.64)",
  linkColor: "#3a6595",
};

const DARK_STYLE: AttributionStyle = {
  backgroundColor: "rgba(20, 24, 28, 0.92)",
  textColor: "#e6e9ee",
  nestedTextColor: "rgba(230, 233, 238, 0.64)",
  linkColor: "#8ab4f8",
};

export const run = async (view: ThreeView<CustomDescriptions>) => {
  // Register plugins before init.
  const defaultPlugin = new DefaultPlugin();
  const attribution = new AttributionPlugin();
  view.addPlugin(defaultPlugin);
  view.addPlugin(attribution);

  await view.init();

  view.toneMappingExposure = 10;

  const scene = defaultPlugin.addDefaultPhotorealScene();
  scene.aerialPerspective.update({
    aerialPerspective: {
      sky: true,
    },
  });

  const items: AttributionItem[] = [];
  const layers: Layer[] = [];

  // GSI raster basemap (no key) — drives the Phase 3 zoom-banded children demo.
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      skirt: false,
    },
  });
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
      opacity: 1,
    },
  });

  // PLATEAU 3D Tiles (no key) — exercises the Phase 4 dynamic-credit path via
  // `featureCreated`. Whether a credit actually arrives depends on whether the
  // tile's glTF embeds `asset.copyright` (Google does; PLATEAU may not).
  const plateauLayer = view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChiyoda.url },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
      castShadow: true,
    },
  });
  // `creditLayerId` nests this layer's dynamic credits under the source
  // (derived from the shared dataset in constants).
  items.push(
    datasetToSource(TILES_3D_DATASETS.plateauChiyoda, {
      creditLayerId: plateauLayer.id,
    }),
  );
  layers.push(plateauLayer);
  // Note: PLATEAU tiles fire `featureCreated` but carry no `asset.copyright`,
  // so they exercise the Phase 4 path without producing a dynamic credit.
  // A copyright-bearing source (e.g. Google) is needed to see dynamic credits.

  // Google Photorealistic 3D Tiles — only when an API key is configured.
  if (GOOGLE_MAPS_API_KEY) {
    const googleLayer = view.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`,
      },
      model: { maxSse: 60 },
    });
    items.push(
      datasetToSource(TILES_3D_DATASETS.googlePhotorealTiles, {
        creditLayerId: googleLayer.id,
        collapsible: true,
      }),
    );
    layers.push(googleLayer);
  }

  items.push(GSI_ATTRIBUTION, SENTINEL_ATTRIBUTION);

  view.setCamera({
    lng: 139.7621830566,
    lat: 35.6776542664,
    height: 800,
    heading: 0,
    pitch: -40,
    roll: 0,
  });

  // Phases 2-4: popover + logo frame, zoom-filtered children (GSI), and
  // dynamic per-feature credits tracked from `layers` (PLATEAU / Google).
  attribution.show(items, layers);

  // Live theme switch — exercises `setStyle()` (light ⇄ dark).
  const pane = new Pane({ title: "Attribution", expanded: true });
  const params = { darkTheme: false };
  pane
    .addBinding(params, "darkTheme", { label: "Dark theme" })
    .on("change", (ev) => {
      attribution.setStyle(ev.value ? DARK_STYLE : LIGHT_STYLE);
    });
};
