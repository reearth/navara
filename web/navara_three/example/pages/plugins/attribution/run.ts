import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";
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

// setStyle() merges, so LIGHT_STYLE must re-specify every field DARK_STYLE sets
// to fully undo dark when toggling back.
const styleFor = (dark: boolean): AttributionStyle =>
  dark ? DARK_STYLE : LIGHT_STYLE;

/** Switchable base layers; the attribution follows whichever is active. */
type Mode = "mapterhorn" | "google";

const INITIAL_CAMERA = {
  lng: 139.7621830566,
  lat: 35.6776542664,
  height: 800,
  heading: 0,
  pitch: -40,
  roll: 0,
};
// GSI seamlessphoto aerial imagery is brighter than the Google tiles, so the
// terrain mode needs a lower exposure to avoid washing out.
const EXPOSURE: Record<Mode, number> = { google: 10, mapterhorn: 1 };

export const run = async () => {
  let currentMode: Mode = GOOGLE_MAPS_API_KEY ? "google" : "mapterhorn";
  let darkTheme = false;
  let view: ThreeView<CustomDescriptions> | null = null;
  let pane: Pane | null = null;
  let attribution: AttributionPlugin | null = null;
  let switching = false;

  // Google embeds per-tile copyright — tracked dynamically via the layer.
  const buildGoogle = (
    v: ThreeView<CustomDescriptions>,
    attribution: AttributionPlugin,
  ) => {
    const google = v.addLayer({
      type: "cesium3dtiles",
      data: {
        url: `${TILES_3D_DATASETS.googlePhotorealTiles.url}?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`,
      },
      model: { maxSse: 60, normals: true },
    });
    attribution.show([
      datasetToSource(TILES_3D_DATASETS.googlePhotorealTiles, {
        creditLayerId: google.id,
      }),
    ]);
  };

  // GSI seamlessphoto imagery draped on Mapterhorn global terrain (raster +
  // terrain) — both providers are credited. Raster sources carry no per-feature
  // credit, so declare them statically: GSI seamlessphoto (zoom-banded children)
  // + the Mapterhorn terrain.
  const buildMapterhorn = (
    v: ThreeView<CustomDescriptions>,
    attribution: AttributionPlugin,
  ) => {
    v.addLayer({
      type: "terrain",
      data: { url: TERRAIN_DATASETS.mapterhorn.url },
      rasterTerrain: {
        maxZoom: 17,
        minZoom: 5,
        elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
        castShadow: true,
        receiveShadow: true,
        tileSize: 512,
      },
    });
    v.addLayer({
      type: "tiles",
      data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
      rasterTile: { maxZoom: 18 },
    });
    attribution.show([
      GSI_ATTRIBUTION,
      datasetToSource(TERRAIN_DATASETS.mapterhorn),
    ]);
  };

  // Build a fresh view for the given mode. Recreating the view (rather than
  // deleting layers in place) gives each base layer a clean slate, so switching
  // never leaves the previous terrain/tiles behind.
  const setup = async (mode: Mode) => {
    currentMode = mode;

    const v = new ThreeView<CustomDescriptions>({});
    view = v;

    const defaultPlugin = new DefaultPlugin();
    const attr = new AttributionPlugin({ style: styleFor(darkTheme) });
    attribution = attr;
    v.addPlugin(defaultPlugin);
    v.addPlugin(attr);

    await v.init();

    const scene = defaultPlugin.addDefaultPhotorealScene();
    // irradiance lights surfaces in post: on for the Google photoreal tiles,
    // off for terrain (lit by the scene's sun directly).
    scene.aerialPerspective.update({
      aerialPerspective: { irradiance: mode === "google" },
    });

    v.toneMappingExposure = EXPOSURE[mode];
    v.setCamera({ ...INITIAL_CAMERA });

    if (mode === "google") {
      buildGoogle(v, attr);
    } else {
      buildMapterhorn(v, attr);
    }

    // Controls: pick the base layer (attribution follows) and toggle the theme.
    const p = new Pane({ title: "Attribution", expanded: true });
    pane = p;
    const modeOptions: Record<string, Mode> = GOOGLE_MAPS_API_KEY
      ? { Mapterhorn: "mapterhorn", "Google 3D Tiles": "google" }
      : { Mapterhorn: "mapterhorn" };
    const params = { mode: currentMode, darkTheme };
    p.addBinding(params, "mode", { label: "Layer", options: modeOptions }).on(
      "change",
      (ev) => switchBase(ev.value),
    );
    p.addBinding(params, "darkTheme", { label: "Dark theme" }).on(
      "change",
      (ev) => {
        darkTheme = ev.value;
        attr.setStyle(styleFor(darkTheme));
      },
    );
  };

  const teardown = () => {
    pane?.dispose();
    pane = null;
    // ThreeView.dispose() doesn't dispose plugins, so remove the attribution UI
    // explicitly — otherwise its popover/dock would leak across switches.
    attribution?.dispose();
    attribution = null;
    view?.dispose();
    view = null;
  };

  const switchBase = async (mode: Mode) => {
    if (switching || mode === currentMode) return;
    switching = true;
    try {
      teardown();
      await setup(mode);
    } finally {
      switching = false;
    }
  };

  await setup(currentMode);
};
