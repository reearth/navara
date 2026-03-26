import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import type { ArclineMeshLayer } from "@navara/three_default_layers";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({ debug: true, shadow: true });
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.7,
    lat: 35.6,
    height: 50000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Effect Layer
  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: true,
    selectiveEffectOcclusion: "normal",
    bloomStrength: 1.0,
    bloomRadius: 0.5,
    bloomThreshold: 0.0,
  });

  // Arc lines from Tokyo to destinations
  view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    effectIds: [bloomEffect.id],
    arcLines: [
      {
        thickness: 2,
        segments: 64,
        arcHeightScale: 0.3,
        srcColor: new Color().setHex(0xffffff),
        tgtColor: new Color().setHex(0xff4444),
        geometry: [
          // Tokyo to Osaka
          { lng: 139.767, lat: 35.681 },
          { lng: 135.502, lat: 34.693 },
          // Tokyo to Sapporo
          { lng: 139.767, lat: 35.681 },
          { lng: 141.347, lat: 43.065 },
          // Tokyo to Fukuoka
          { lng: 139.767, lat: 35.681 },
          { lng: 130.418, lat: 33.59 },
        ],
      },
    ],
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
    },
  });
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.openstreetmap]);
};

run();
