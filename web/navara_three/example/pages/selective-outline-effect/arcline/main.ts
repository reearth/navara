import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import type { LatLng } from "@navara/core";
import type { ArclineMeshLayer } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

type GeoJsonFeature = {
  properties: {
    S10b_001: string; // source airport
    S10b_004: string; // destination airport
    S10b_007: number; // traffic volume
  };
  geometry: {
    coordinates: [[[number, number], [number, number]]];
  };
};

type GeoJsonData = {
  features: GeoJsonFeature[];
};

/**
 * Parse GeoJSON and deduplicate bidirectional routes (keep higher volume).
 * Returns routes grouped by traffic tier.
 */
function parseAirportRoutes(data: GeoJsonData) {
  // Deduplicate: for A→B and B→A, keep the one with higher volume
  const routeMap = new Map<string, { volume: number; geometry: LatLng[] }>();

  for (const feature of data.features) {
    const coords = feature.geometry.coordinates[0];
    const src = coords[0];
    const tgt = coords[1];
    const volume = feature.properties.S10b_007 ?? 0;

    // Create a canonical key (sorted by coordinates)
    const key =
      src[0] < tgt[0] || (src[0] === tgt[0] && src[1] < tgt[1])
        ? `${src[0]},${src[1]}-${tgt[0]},${tgt[1]}`
        : `${tgt[0]},${tgt[1]}-${src[0]},${src[1]}`;

    const existing = routeMap.get(key);
    if (!existing || volume > existing.volume) {
      routeMap.set(key, {
        volume,
        geometry: [
          { lng: src[0], lat: src[1] },
          { lng: tgt[0], lat: tgt[1] },
        ],
      });
    }
  }

  // Group by traffic tier
  const high: LatLng[] = [];
  const mid: LatLng[] = [];
  const low: LatLng[] = [];

  for (const route of routeMap.values()) {
    if (route.volume >= 1_000_000) {
      high.push(...route.geometry);
    } else if (route.volume >= 100_000) {
      mid.push(...route.geometry);
    } else {
      low.push(...route.geometry);
    }
  }

  return { high, mid, low };
}

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date.setHours(8);

  // Selective outline effect
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 0.5,
      edgeStrength: 1.0,
    },
  });

  view.addDefaultEffectLayers();

  // Parse airport traffic data
  const response = await fetch("/airport-traffic-volume.geojson");
  const geojsonData = (await response.json()) as GeoJsonData;
  const routes = parseAirportRoutes(geojsonData);

  // Arc lines with outline — tiered by traffic volume
  view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    effectIds: [outlineEffect.id],
    arcLines: [
      {
        thickness: 3,
        segments: 64,
        arcHeightScale: 0.3,
        srcColor: new Color().setHex(0xff4400),
        tgtColor: new Color().setHex(0xffaa00),
        geometry: routes.high,
      },
      {
        thickness: 2,
        segments: 64,
        arcHeightScale: 0.25,
        srcColor: new Color().setHex(0xffaa00),
        tgtColor: new Color().setHex(0xffdd44),
        geometry: routes.mid,
      },
      {
        thickness: 1,
        segments: 48,
        arcHeightScale: 0.2,
        srcColor: new Color().setHex(0x4488ff),
        tgtColor: new Color().setHex(0x66ccff),
        geometry: routes.low,
      },
    ],
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
