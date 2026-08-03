import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import type { FeatureCollection } from "geojson";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";

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
    lng: 139.775,
    lat: 35.626,
    height: 400,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Selective outline effect
  const outlineEffect = view.addEffect({
    selectiveOutline: {
      color: new Color().setHex(0x00ff00),
      thickness: 2.0,
      edgeStrength: 1.0,
    },
  });

  // GeoJSON polygon with outline (Odaiba)
  const odaibaFeature: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [139.773, 35.628],
              [139.777, 35.628],
              [139.777, 35.631],
              [139.773, 35.631],
              [139.773, 35.628],
            ],
          ],
        },
      },
    ],
  };

  const odaibaFeatureSource = view.addSource({
    type: "geojson",
    data: odaibaFeature,
  });
  view.addLayer({
    type: "vector",
    source: odaibaFeatureSource,
    polygon: {
      show: true,
      color: new Color().setHex(0xffa500),
      extrudedHeight: 80,
      clampToGround: false,
      effectIds: [outlineEffect.id],
    },
  });

  // Base layers
  const terrainDem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  });
  view.addLayer({
    type: "terrain",
    source: terrainDem,
    terrain: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "raster",
    source: terrainDem,
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
