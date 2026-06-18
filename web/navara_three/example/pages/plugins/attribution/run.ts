import ThreeView, {
  TERRARIUM_ELEVATION_DECODER,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import {
  AttributionPlugin,
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

import { GSI_ATTRIBUTION } from "./data/attributions";

export type CustomDescriptions = DefaultDescriptions;

// setStyle() merges, so LIGHT_STYLE re-applies the defaults to undo dark.
const LIGHT_STYLE: AttributionStyle = {
  backgroundColor: "rgba(252, 253, 254, 0.96)",
  textColor: "#1b1f24",
  nestedTextColor: "rgba(27, 31, 36, 0.64)",
  linkColor: "#3a6595",
  borderColor: "rgba(0, 0, 0, 0.08)",
};

const DARK_STYLE: AttributionStyle = {
  backgroundColor: "rgba(20, 24, 28, 0.92)",
  textColor: "#e6e9ee",
  nestedTextColor: "rgba(230, 233, 238, 0.64)",
  linkColor: "#8ab4f8",
  // A lighter divider so the header border stays visible on the dark popover.
  borderColor: "rgba(255, 255, 255, 0.14)",
};

/** Switchable base layers; the attribution follows whichever is active. */
type Mode = "mapterhorn" | "google";

export const run = async (view: ThreeView<CustomDescriptions>) => {
  // Register plugins before init.
  const defaultPlugin = new DefaultPlugin();
  const attribution = new AttributionPlugin();
  view.addPlugin(defaultPlugin);
  view.addPlugin(attribution);

  await view.init();

  const scene = defaultPlugin.addDefaultPhotorealScene();
  scene.aerialPerspective.update({ aerialPerspective: { sky: true } });

  view.setCamera({
    lng: 139.7621830566,
    lat: 35.6776542664,
    height: 800,
    heading: 0,
    pitch: -40,
    roll: 0,
  });

  // Layers belonging to the current mode — deleted before switching, so only
  // one base layer set is shown at a time (no unnatural overlap).
  let activeLayers: Layer[] = [];
  const clearLayers = () => {
    for (const layer of activeLayers) layer.delete();
    activeLayers = [];
  };

  const addSeamlessphoto = (): Layer =>
    view.addLayer({
      type: "tiles",
      data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
      rasterTile: { maxZoom: 18 },
    });

  // Swap the visible layers and update the attribution to match them.
  const applyMode = (mode: Mode) => {
    clearLayers();

    if (mode === "google") {
      const google = view.addLayer({
        type: "cesium3dtiles",
        data: {
          url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`,
        },
        model: { maxSse: 60 },
      });
      activeLayers = [google];
      view.toneMappingExposure = 10;
      // Google embeds per-tile copyright — tracked dynamically via the layer.
      attribution.show(
        [
          datasetToSource(TILES_3D_DATASETS.googlePhotorealTiles, {
            creditLayerId: google.id,
          }),
        ],
        [google],
      );
      return;
    }

    // GSI seamlessphoto imagery draped on Mapterhorn global terrain
    // (raster + terrain) — both providers are credited.
    const terrain = view.addLayer({
      type: "terrain",
      data: { url: TERRAIN_DATASETS.mapterhorn.url },
      rasterTerrain: {
        maxZoom: 17,
        minZoom: 5,
        elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
        skirt: false,
      },
    });
    activeLayers = [terrain, addSeamlessphoto()];
    view.toneMappingExposure = 1;
    // Raster sources carry no per-feature credit, so declare them statically:
    // GSI seamlessphoto (zoom-banded children) + the Mapterhorn terrain.
    attribution.show([
      GSI_ATTRIBUTION,
      datasetToSource(TERRAIN_DATASETS.mapterhorn),
    ]);
  };

  // Controls: pick the base layer (attribution follows) and toggle the theme.
  const pane = new Pane({ title: "Attribution", expanded: true });
  const modeOptions: Record<string, Mode> = GOOGLE_MAPS_API_KEY
    ? { Mapterhorn: "mapterhorn", "Google 3D Tiles": "google" }
    : { Mapterhorn: "mapterhorn" };
  const params: { mode: Mode; darkTheme: boolean } = {
    mode: GOOGLE_MAPS_API_KEY ? "google" : "mapterhorn",
    darkTheme: false,
  };
  pane
    .addBinding(params, "mode", { label: "Layer", options: modeOptions })
    .on("change", (ev) => applyMode(ev.value));
  pane
    .addBinding(params, "darkTheme", { label: "Dark theme" })
    .on("change", (ev) =>
      attribution.setStyle(ev.value ? DARK_STYLE : LIGHT_STYLE),
    );

  applyMode(params.mode);
};
