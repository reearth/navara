import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import type { ArclineMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";

const TOKYO = { lng: 139.757, lat: 35.676 };

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date = atZoneTime(view.atmosphere.date, 8);

  view.setCamera({
    lng: 130,
    lat: 30,
    height: 1500000,
    heading: 0,
    pitch: -60,
    roll: 0,
  });

  // Selective bloom effect
  const bloomEffect = view.addEffect({
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
    },
  });

  // Arc lines with bloom (Tokyo to Asian cities)
  view.addMesh<ArclineMeshDesc>({
    effectIds: [bloomEffect.id],
    emissiveColor: new Color().setHex(0xffffff),
    emissiveIntensity: 0.5,
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
  const gsiTerrainDem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 5,
  });
  view.addLayer({
    type: "terrain",
    source: gsiTerrainDem,
    terrain: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "raster",
    source: gsiTerrainDem,
    hillshade: {},
  });

  const openstreetmap = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({
    type: "raster",
    source: openstreetmap,
  });

  attribution?.add([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
