import ThreeView, { Color, ToneMappingMode } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultAtmospheres = view.addDefaultAtmosphereLayers();
  defaultAtmospheres.sun.update({
    sun: {
      castShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  // Enable shadow for raster tile.
  view.addLayer({
    type: "terrain",
    ellipsoid: {
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.toneMappingExposure = 5;
  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
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

  view.addLayer({
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
    polyline: {
      color: new Color().setStyle("#ff0000"),
      width: 2,
    },
  });

  view.addLayer({
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

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TILES_3D_DATASETS.plateauChiyoda,
  ]);
};
