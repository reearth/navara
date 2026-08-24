import ThreeView from "@navaramap/three";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView();

const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.setCamera({
  lng: 138.014,
  lat: 34.7755,
  distance: 220,
  heading: 326,
  pitch: -34,
  roll: 0,
  height: 25,
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
});
view.addLayer({ type: "terrain", source: terrain });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const castle = view.addSource({
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/6b/68c785-f43d-4451-ba7f-d4d130ef6ba5/uc_pv1_22213_kakegawa/pointcloud/22213_kakegawa_castle/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: castle,
  model: { pointSize: 0.3, maxSse: 8 },
});

view.attribution?.add([
  {
    attribution: "kakegawa castle point cloud model - MLIT PLATEAU",
    attributionUrl: "https://www.geospatial.jp/ckan/dataset/kakegawacastle",
  },
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
]);

initializeExample(view);
