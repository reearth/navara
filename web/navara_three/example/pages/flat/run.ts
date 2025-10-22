import ThreeView from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  // kag castle
  view.flyTo({
    lat: 34.775417,
    lng: 138.014733,
    height: 300,
  });


  //   view.flyTo({
  //   lat: 39.85328,
  //   lng: 284.38791,
  //   height: 300,
  // });

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
    // data: { url: "https://raw.githubusercontent.com/CesiumGS/cesium/refs/heads/main/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudConstantColor/pointCloudConstantColor.pnts", },
    // data: { url: "https://raw.githubusercontent.com/CesiumGS/cesium/refs/heads/main/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudDraco/pointCloudDraco.pnts", },
    // data: { url: "https://raw.githubusercontent.com/CesiumGS/cesium/refs/heads/main/Apps/SampleData/Cesium3DTiles/PointCloud/PointCloudDraco/tileset.json", },
    // data: { url: "https://assets.cms.plateau.reearth.io/assets/6b/68c785-f43d-4451-ba7f-d4d130ef6ba5/uc_pv1_22213_kakegawa/pointcloud/22213_kakegawa_castle/0/0.pnts", },
    data: { url: "https://assets.cms.plateau.reearth.io/assets/6b/68c785-f43d-4451-ba7f-d4d130ef6ba5/uc_pv1_22213_kakegawa/pointcloud/22213_kakegawa_castle/tileset.json", },
    // data: { uri: "/public/pnts/PointCloudConstantColor/pointCloudConstantColor.pnts", },
    model: {
      show: true,
      // id_property: "gml_id",
      // color: 0xff0000,
      // metalness: 0,
      // roughness: 1,
      // cast_shadow: true,
      // receive_shadow: true,
      // height: 0,
      // size: 1,
      // point_cloud: true,
    },
  });


  showAttributions([TILE_DATASETS.openstreetmap]);
};
