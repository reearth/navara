import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
} from "@navara/three";
import { AxesHelper } from "three";

const terrainUrls = {
  gsi: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  mapbox: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${
    import.meta.env.NAVARA_MAPBOX_ACCESS_TOKEN
  }`,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scenes.opaque.add(axesHelper);

  view.addLayer({
    type: "tiles",
    data: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    },
    raster_tile: {
      max_zoom: 23,
      wireframe: false,
    },
  });

  const terrainType: "mapbox" | "gsi" = "gsi";

  view.addLayer({
    type: "terrain",
    data: {
      // @ts-expect-error : Make switch button later
      url: terrainType === "mapbox" ? terrainUrls.mapbox : terrainUrls.gsi,
    },
    raster_terrain: {
      segments: 64,
      max_zoom: 15,
      min_zoom: 5,
      wireframe: false,
      elevation_decoder:
        // @ts-expect-error : Make switch button later
        terrainType === "mapbox"
          ? MAPBOX_ELEVATION_DECODER()
          : JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "mvt",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
    },
    point: {
      size: 1000,
      scale_by_distance: false,
      color: 0xff0000,
    },
    // text: {
    //   color: 0xff00ff,
    //   size: 30,
    //   scale_by_distance: true,
    //   text: "MVT",
    // },
    polyline: {
      show: true,
      color: 0x3d1623,
      width: 2,
      height: 1,
      clamp_to_ground: true,
    },
    polygon: {
      color: 0x00aaff,
      height: 10,
      extruded_height: 0,
      clamp_to_ground: true,
      wireframe: false,
    },
    vector_tile: {
      max_zoom: 16,
    },
  });
};
