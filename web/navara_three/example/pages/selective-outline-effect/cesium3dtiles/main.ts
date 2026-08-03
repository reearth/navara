import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../../helpers/constants";
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
    lng: 139.7511,
    lat: 35.6736,
    height: 902,
    heading: 64.4,
    pitch: -36,
    roll: 0,
  });

  // Selective outline effect
  const outlineEffect = view.addEffect({
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 1.0,
      edgeStrength: 1.0,
    },
  });

  // Cesium 3D Tiles with outline (Chiyoda buildings)
  const chiyodaSource = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.plateauChiyoda.url,
  });
  view.addLayer({
    type: "3d-tiles",
    source: chiyodaSource,
    model: {
      show: true,
      color: new Color().setHex(0xffffff),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
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

  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);
};

run();
