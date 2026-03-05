import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import type { ArclineMeshLayer } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const TOKYO = { lng: 139.757, lat: 35.676 };

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

  view.setCamera({
    lng: 130,
    lat: 30,
    height: 1500000,
    heading: 0,
    pitch: -60,
    roll: 0,
  });

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

  // Arc lines with outline (Tokyo to Asian cities)
  view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    effectIds: [outlineEffect.id],
    arcLines: [
      {
        thickness: 2,
        segments: 64,
        arcHeightScale: 0.3,
        srcColor: new Color().setHex(0xffffff),
        tgtColor: new Color().setHex(0xff6600),
        geometry: [
          TOKYO,
          { lng: 126.44, lat: 37.46 }, // Seoul
          TOKYO,
          { lng: 121.23, lat: 25.08 }, // Taipei
          TOKYO,
          { lng: 113.92, lat: 22.31 }, // Hong Kong
        ],
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
