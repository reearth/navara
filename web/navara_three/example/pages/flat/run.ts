import ThreeView, { Color } from "@navaramap/three";
import { ToneMappingMode } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  const attribution = view.attribution;

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: {
      castShadow: true,
    },
  });

  view.toneMappingExposure = 1;
  defaultAtmospheres.toneMapping.update({
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  const osmSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({
    type: "raster",
    source: osmSource,
  });

  // Enable shadow for raster tile.
  view.addLayer({
    type: "terrain",
    ellipsoid: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  const chiyodaSource = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.plateauChiyoda.url,
  });
  view.addLayer({
    type: "3d-tiles",
    source: chiyodaSource,
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0,
      roughness: 1,
      castShadow: true,
      receiveShadow: true,
      height: -50,
    },
  });

  const lineSource = view.addSource({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [138.64270223212833, 35.42793245331515],
          [138.8398612065625, 35.42635304536398],
          [138.64071756664583, 35.33027587314082],
          [138.8449071750585, 35.32671062382879],
        ],
        type: "LineString",
      },
    },
  });
  view.addLayer({
    type: "vector",
    source: lineSource,
    polyline: {
      color: new Color().setStyle("#ff0000"),
      width: 2,
    },
  });

  const polygonSource = view.addSource({
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
        ],
        type: "Polygon",
      },
    },
  });
  view.addLayer({
    type: "vector",
    source: polygonSource,
    polygon: {},
  });

  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const pane = new Pane();

  addDateControl(view, pane);
  addCameraControl(view, pane);

  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);
};
