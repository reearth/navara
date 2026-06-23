import ThreeView, {
  Color,
  type FeatureEvaluator,
  type Layer,
} from "@navara/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { PMTILES_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

import LABEL_FONT_FAMILY from "./labelFontFamily.json";

export type CustomDescriptions = DefaultDescriptions;

// The family name the faces are registered under (see labelFontFamily.json).
const LABEL_FONT = "OvertureLabels";

// Camera presets for exploring the worldwide archive.
const VIEWPOINTS = {
  World: { lng: 10, lat: 25, height: 22_000_000, pitch: -90 },
  Europe: { lng: 12, lat: 48, height: 4_500_000, pitch: -90 },
  "East Asia": { lng: 121, lat: 33, height: 5_000_000, pitch: -90 },
  Americas: { lng: -95, lat: 35, height: 8_000_000, pitch: -90 },
} as const;

const LABEL_TIERS = [
  {
    key: "country",
    maxHeight: 4_000_000,
    match: ["country"],
  },
  {
    key: "region",
    maxHeight: 2_000_000,
    match: ["region", "macroregion", "governorate", "province", "state"],
  },
  {
    key: "county",
    maxHeight: 800_000,
    match: ["county", "macrocounty", "localadmin", "district"],
  },
  {
    key: "locality",
    maxHeight: 100_000,
    match: ["locality", "city", "town"],
  },
];

// Reverse index: normalized property value -> tier index (first tier wins).
const TIER_INDEX_OF = new Map<string, number>();
LABEL_TIERS.forEach((tier, i) => {
  for (const value of tier.match) {
    if (!TIER_INDEX_OF.has(value)) TIER_INDEX_OF.set(value, i);
  }
});

// Within the finest (`locality`) tier, still drop everything but large cities
// to keep dense regions legible.
const CITY_POPULATION_THRESHOLD = 1_000_000;

const BASE_POLYGONS = [
  { title: "Land", source: "land", color: "#f8f4f1" }, // sand.50
  // { title: "Land cover", source: "land_cover", color: "#c4eaa9" }, // grass fallback
  { title: "Land use", source: "land_use", color: "#d6ecd5" }, // park green.200
  { title: "Water", source: "water", color: "#79cdf6" }, // ocean.900
] as const;

// 3D buildings (Overture `buildings` theme). The `building` MVT layer carries a
// real `height` in meters; where it's missing we estimate from `num_floors`
// (~3 m per floor) and finally fall back to a small default so footprints are
// never extruded to zero.
const BUILDING_COLOR = "#cabfb3"; // sand.300
const METERS_PER_FLOOR = 3;
const DEFAULT_BUILDING_HEIGHT = 6;

const LAND_COVER_COLORS: Record<string, string> = {
  forest: "#a2e2a4", // green.500
  mangrove: "#a1e3cf", // teal.100
  grass: "#c4eaa9", // green.400
  shrub: "#d8eaae", // olive.200
  crop: "#ebedb1", // yellow.300
  wetland: "#afe9e7", // teal.50
  moss: "#95daaa", // green.600
  barren: "#efe8cd", // yellow.200
  snow: "#f3f5f7", // sky.50
  urban: "#e8ded4", // sand.400
};

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  view.addFontFamily(LABEL_FONT_FAMILY);

  view.addLight({ ambient: {} });
  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  view.setCamera({ ...VIEWPOINTS.World, heading: 0, roll: 0 });

  view.addLayer({ type: "terrain", ellipsoid: {} });

  const baseUrl = PMTILES_DATASETS.overtureBase.url;
  const divisionsUrl = PMTILES_DATASETS.overtureDivisions.url;

  // Visibility is driven per-feature through each layer's evaluator rather than
  // the material's `show`. A material-level `show` only seeds features created
  // afterward, whereas the evaluator sets `show` on already-batched tile
  // geometry — so toggling re-styles what's already on screen.
  const visible: Record<string, boolean> = {};

  // The `vectorTile.layers` filter selects which MVT layer inside the shared
  // archive each Navara layer styles (same mechanism as the MVT example). Every
  // layer reusing the same URL resolves through a single PmtilesSource.
  const toggles: { title: string; layer: Layer }[] = [];

  // Precompute the per-subtype Color instances once and reuse them across
  // features (the evaluator runs per feature, per tile).
  const landCoverColors: Record<string, Color> = Object.fromEntries(
    Object.entries(LAND_COVER_COLORS).map(([k, hex]) => [
      k,
      new Color().setStyle(hex),
    ]),
  );

  for (const { title, source, color } of BASE_POLYGONS) {
    visible[title] = true;
    const layer = view.addLayer({
      type: "mvt",
      data: { url: baseUrl },
      polygon: {
        color: new Color().setStyle(color),
        clampToGround: true,
      },
      vectorTile: { maxZoom: 13, layers: [source] },
    });

    // Apply the current visibility to each feature set, both on initial load
    // and on every forced re-style (toggle). `land_cover` additionally colors
    // each feature by its `subtype`.
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      if (source === "land_cover") {
        evaluator.evaluate(
          ({ properties }) => {
            const subtype = properties?.["subtype"] as string | undefined;
            const subtypeColor = subtype ? landCoverColors[subtype] : undefined;
            return subtypeColor
              ? { show: visible[title], color: subtypeColor }
              : { show: visible[title] };
          },
          { filters: ["subtype"] },
        );
      } else {
        evaluator.evaluate(() => ({ show: visible[title] }), { filters: [] });
      }
    };
    layer.on("featureCreated", apply);
    layer.on("featureUpdated", apply);

    toggles.push({ title, layer });
  }

  // Administrative boundaries from the `divisions` theme.
  const boundaryTitle = "Boundaries";
  visible[boundaryTitle] = true;
  const boundaryLayer = view.addLayer({
    type: "mvt",
    data: { url: divisionsUrl },
    polyline: {
      color: new Color().setStyle("#757575"), // division.boundary gray.700
      width: 1.5,
      height: 1,
      clampToGround: true,
    },
    vectorTile: { maxZoom: 12, layers: ["division_boundary"] },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(() => ({ show: visible[boundaryTitle] }), {
        filters: [],
      });
    };
    boundaryLayer.on("featureCreated", apply);
    boundaryLayer.on("featureUpdated", apply);
    toggles.push({ title: boundaryTitle, layer: boundaryLayer });
  }

  // 3D buildings from the `buildings` theme. Each footprint is extruded by the
  // per-feature `extrudedHeight` (meters) set in the evaluator below — the
  // polygon shader raises the roof from the ground (so `clampToGround` is off,
  // it would otherwise drape the geometry onto terrain and ignore the height).
  // These only exist at z5–z14, so they appear only once the camera descends.
  //
  // Two MVT layers cooperate here, following the OSM/Overture 3D convention:
  //   • `building`      — one footprint per building (the city's bulk massing).
  //   • `building_part` — detailed sub-volumes for buildings modeled in 3D.
  // Overture reliably tags `height` on parts but only sparsely on footprints,
  // so the parts are what make landmark buildings read as real shapes. Where a
  // footprint `has_parts`, we hide it and let its parts stand in — otherwise the
  // footprint and its parts double-draw and z-fight.
  const buildingsTitle = "Buildings";
  visible[buildingsTitle] = true;
  const buildingColor = new Color().setStyle(BUILDING_COLOR);

  // Bulk footprints. Hidden where `has_parts`, so detailed parts represent them.
  const buildingLayer = view.addLayer({
    type: "mvt",
    data: { url: PMTILES_DATASETS.overtureBuildings.url },
    polygon: {
      color: buildingColor,
      // Seeds the attribute slots; the evaluator overrides height per feature.
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
    vectorTile: { maxZoom: 14, layers: ["building"] },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[buildingsTitle]) return { show: false };
          // Buildings with detailed parts are drawn by the part layer instead.
          if (properties?.["has_parts"] === true) return { show: false };

          const height = properties?.["height"] as number | undefined;
          const numFloors = properties?.["num_floors"] as number | undefined;
          const extrudedHeight =
            height ??
            (numFloors != null
              ? numFloors * METERS_PER_FLOOR
              : DEFAULT_BUILDING_HEIGHT);

          return { show: true, extrudedHeight };
        },
        { filters: ["height", "num_floors", "has_parts"] },
      );
    };
    buildingLayer.on("featureCreated", apply);
    buildingLayer.on("featureUpdated", apply);
    toggles.push({ title: buildingsTitle, layer: buildingLayer });
  }

  // Detailed building parts. A part spans `min_height` (its base elevation) to
  // `height` (its top), so we set the polygon's base (`height` attribute) to
  // `min_height` and its top (`extrudedHeight`) to `height` — this keeps stacked
  // setbacks from overlapping and lets towers float above their podium.
  const buildingPartLayer = view.addLayer({
    type: "mvt",
    data: { url: PMTILES_DATASETS.overtureBuildings.url },
    polygon: {
      color: buildingColor,
      height: 0,
      extrudedHeight: 0,
      clampToGround: false,
    },
    vectorTile: { maxZoom: 14, layers: ["building_part"] },
  });
  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[buildingsTitle]) return { show: false };

          const top = properties?.["height"] as number | undefined;
          const numFloors = properties?.["num_floors"] as number | undefined;
          const base = (properties?.["min_height"] as number | undefined) ?? 0;
          const extrudedHeight =
            top ??
            (numFloors != null
              ? numFloors * METERS_PER_FLOOR
              : DEFAULT_BUILDING_HEIGHT);

          // Skip degenerate parts whose base is at or above their top.
          if (extrudedHeight <= base) return { show: false };

          return { show: true, height: base, extrudedHeight };
        },
        { filters: ["height", "num_floors", "min_height"] },
      );
    };
    buildingPartLayer.on("featureCreated", apply);
    buildingPartLayer.on("featureUpdated", apply);
    // Same title as the footprint layer: one "Buildings" toggle drives both, and
    // `restyle()` force-updates both. The panel dedupes the repeated title.
    toggles.push({ title: buildingsTitle, layer: buildingPartLayer });
  }

  // A single text layer for labels in every script. Overture stores the
  // localized primary name under the `@name` property; the registered font
  // family resolves the correct face per glyph.
  const labelTitle = "Labels";
  visible[labelTitle] = true;
  const params = { size: 20 };

  // The evaluator (which runs per feature) reads this closure variable to decide
  // which tiers are currently visible. We keep it in sync with the camera below
  // and re-run the evaluator only when crossing a tier threshold.
  //
  // Seed it from the initial viewpoint rather than `view.camera.positionGeographic`:
  // that getter reads the WASM core's camera status, which isn't computed until
  // the engine ticks its first frame, so reading it here would throw.
  let currentHeight: number = VIEWPOINTS.World.height;

  const labelLayer = view.addLayer({
    type: "mvt",
    data: { url: divisionsUrl },
    text: {
      font: LABEL_FONT,
      color: new Color().setStyle("#000000"),
      size: params.size,
      sizeInMeters: false,
      clampToGround: true,
      center: { x: 0.5, y: 0.5 },
      outlineColor: new Color().setStyle("#ffffff"),
      outlineWidth: 5,
      outlineOpacity: 0.4,
      offsetDepth: true,
      depthTest: true,
    },
    // Finer admin features (governorate/district) only exist in higher-zoom
    // tiles, so we fetch up to z12 (matching the boundary layer) and rely on
    // the altitude tiers below to keep the world view uncluttered.
    vectorTile: { maxZoom: 12, layers: ["division"] },
  });

  {
    const apply = ({ evaluator }: { evaluator: FeatureEvaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          if (!visible[labelTitle]) return { show: false };

          const name = properties?.["@name"] as string | undefined;
          if (!name) return { text: "", show: false };

          // Assign the feature to an altitude tier: prefer the locale-specific
          // `local_type` (governorate/district/…), fall back to the stable
          // `subtype` enum. Anything unrecognized is never labeled.
          const localType = (
            properties?.["local_type"] as string | undefined
          )?.toLowerCase();
          const subtype = (
            properties?.["subtype"] as string | undefined
          )?.toLowerCase();
          const tierIndex =
            (localType !== undefined
              ? TIER_INDEX_OF.get(localType)
              : undefined) ??
            (subtype !== undefined ? TIER_INDEX_OF.get(subtype) : undefined);
          if (tierIndex === undefined) return { text: "", show: false };

          const tier = LABEL_TIERS[tierIndex];

          // Hidden until the camera descends to this tier's altitude band.
          if (currentHeight > tier.maxHeight) return { text: "", show: false };

          // Within the locality tier, still keep only the largest cities.
          if (tier.key === "locality") {
            const population = properties?.["population"] as number | undefined;
            if ((population ?? 0) < CITY_POPULATION_THRESHOLD) {
              return { text: "", show: false };
            }
          }

          return { text: name, show: true };
        },
        { filters: ["@name", "subtype", "local_type", "population"] },
      );
    };
    labelLayer.on("featureCreated", apply);
    labelLayer.on("featureUpdated", apply);
    // toggles.push({ title: labelTitle, layer: labelLayer });
  }

  // Drive label visibility from camera altitude. The set of visible tiers only
  // changes when `currentHeight` crosses a tier's `maxHeight`, so we encode the
  // current set as a "band key" and re-style only on a change — `move` fires
  // continuously while the camera animates, and re-evaluating every frame would
  // thrash the batcher for no visible difference.
  const bandKeyAt = (height: number) =>
    LABEL_TIERS.map((tier) => (height <= tier.maxHeight ? "1" : "0")).join("");
  let lastBandKey = bandKeyAt(currentHeight);
  // The single `move` handler that drives both the altitude readout and the
  // tier restyle is registered at the end, once the control panel exists.

  // Re-evaluate every layer and request a render. `forceUpdate` re-emits
  // `featureUpdated` for all loaded tiles, so a toggle flips visibility on
  // existing geometry immediately rather than only on the next data load.
  const restyle = () => {
    for (const { layer } of toggles) layer.forceUpdate();
    view.forceUpdate();
  };

  // ---- Control panel -------------------------------------------------------
  const pane = new Pane({ title: "Overture worldwide PMTiles" });

  const viewFolder = pane.addFolder({ title: "Viewpoints" });
  (Object.keys(VIEWPOINTS) as (keyof typeof VIEWPOINTS)[]).forEach((name) => {
    viewFolder.addButton({ title: name }).on("click", () => {
      view.setCamera({ ...VIEWPOINTS[name], heading: 0, roll: 0 });
    });
  });

  // Layer toggles — flipping any checkbox re-styles every layer immediately.
  // Some titles map to more than one layer (e.g. "Buildings" drives both the
  // footprint and part layers), so add a single binding per distinct title.
  const layersFolder = pane.addFolder({ title: "Layers" });
  const boundToggleTitles = new Set<string>();
  for (const { title } of toggles) {
    if (boundToggleTitles.has(title)) continue;
    boundToggleTitles.add(title);
    layersFolder.addBinding(visible, title).on("change", () => {
      restyle();
    });
  }

  layersFolder
    .addBinding(params, "size", {
      min: 10,
      max: 100,
      step: 1,
      label: "label size",
    })
    .on("change", ({ value }) => {
      labelLayer.update({ text: { size: value } });
      view.forceUpdate();
    });

  // Live-tunable altitude thresholds (km). The `country` tier is always visible
  // (Infinity), so only the finer, finite tiers are exposed. Changing one
  // re-evaluates the labels immediately against the current camera height.
  const tiersFolder = pane.addFolder({ title: "Label altitude (km)" });
  for (const tier of LABEL_TIERS) {
    const proxy = { km: Math.round(tier.maxHeight / 1000) };
    tiersFolder
      .addBinding(proxy, "km", {
        min: 100,
        max: 20_000,
        step: 100,
        label: tier.key,
      })
      .on("change", ({ value }) => {
        tier.maxHeight = value * 1000;
        lastBandKey = bandKeyAt(currentHeight);
        labelLayer.forceUpdate();
        view.forceUpdate();
      });
  }

  // Read-only altitude readout. A `readonly` binding infers its view from the
  // bound value's type (string -> text monitor); we mutate `readout.altitude`
  // and call `.refresh()` from the move handler to update it.
  const readout = { altitude: `${(currentHeight / 1000).toFixed(0)} km` };
  const altitudeMonitor = pane.addBinding(readout, "altitude", {
    readonly: true,
    label: "Camera Altitude",
  });

  // One handler for both jobs: update the readout every move, and restyle the
  // labels only when the camera crosses a tier threshold.
  view.camera.on("move", () => {
    // `positionGeographic` throws if the core's camera status isn't ready yet;
    // skip this tick rather than letting it escape the camera event loop.
    let height: number;
    try {
      height = view.camera.positionGeographic.height;
    } catch {
      return;
    }
    currentHeight = height;

    readout.altitude = `${(currentHeight / 1000).toFixed(0)} km`;
    altitudeMonitor.refresh();

    const bandKey = bandKeyAt(currentHeight);
    if (bandKey === lastBandKey) return;
    lastBandKey = bandKey;
    // Re-run the label evaluator against the new altitude and redraw.
    labelLayer.forceUpdate();
    view.forceUpdate();
  });

  showAttributions([
    PMTILES_DATASETS.overtureBase,
    PMTILES_DATASETS.overtureDivisions,
    PMTILES_DATASETS.overtureBuildings,
  ]);
};
