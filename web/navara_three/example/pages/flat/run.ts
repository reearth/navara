import ThreeView from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    raster_tile: {
      max_zoom: 23,
    },
  });

  // view.addLayer({
  //   type: "geojson",
  //   data: {
  //     type: "Feature",
  //     properties: {},
  //     geometry: {
  //       coordinates: [
  //         [138.64270223212833, 35.42793245331515],
  //         [138.8398612065625, 35.42635304536398],
  //         [138.64071756664583, 35.33027587314082],
  //         [138.8449071750585, 35.32671062382879],
  //       ],
  //       type: "LineString",
  //     },
  //   },
  //   polyline: {
  //     color: 0xff0000,
  //     width: 2,
  //   },
  // });

  // view.addLayer({
  //   type: "geojson",
  //   data: {
  //     type: "Feature",
  //     properties: {},
  //     geometry: {
  //       coordinates: [
  //         [
  //           [138.66861922558115, 35.46838056308519],
  //           [138.6559918549957, 35.29164005065681],
  //           [138.81174182884172, 35.279838616806046],
  //           [138.8071009152797, 35.436389815907134],
  //           [138.66861922558115, 35.46838056308519],
  //         ],
  //       ],
  //       type: "Polygon",
  //     },
  //   },
  //   polygon: {},
  // });

  // view.addLayer({
  //   type: "cesium3dtiles",
  //   data: {
  //     url: TILES_3D_DATASETS.plateauChuo.url,
  //   },
  //   model: {
  //     show: true,
  //     id_property: "gml_id",
  //     color: 0xffffff,
  //     metalness: 0,
  //     roughness: 1,
  //     cast_shadow: true,
  //     receive_shadow: true,
  //     height: -50,
  //   },
  // });

    view.addLayer({
    type: "cesium3dtiles",
    data: { url: "https://raw.githubusercontent.com/adel-elmala/dummy-assets/refs/heads/main/pnts/tileset.json", },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
      cast_shadow: true,
      receive_shadow: true,
      height: 50,
      size: 100000,
    },
  });


  showAttributions([TILE_DATASETS.openstreetmap]);
};
