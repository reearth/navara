import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
} from "@navara/three";
import { AmbientLight, AxesHelper, DirectionalLight } from "three";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

const terrainUrls = {
  gsi: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  mapbox: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${
    import.meta.env.NAVARA_MAPBOX_ACCESS_TOKEN
  }`,
};

export const run = async (view: ThreeView) => {
  await view.init();

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scene.add(axesHelper);

  const ambientLight = new AmbientLight(0xffffff, 0.2);
  view.scene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff);
  directionalLight.position.set(1, 1, 1);
  view.scene.add(directionalLight);

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.gsiSeamlessphoto },
    raster_tile: {
      segments: 10,
      color: 0xcccccc,
      max_sse: 2,
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
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.73470764482283, 35.3627947204036],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.7311922738062, 35.359766379480206],
            type: "Point",
          },
        },
      ],
    },
    billboard: {
      color: 0xffffff,
      size: 0.05,
      height: 1,
      // TODO: This should be abstracted like top-left/center/right, bottom-left/center/right
      center: {
        x: 0.5,
        y: 0,
      },
      scale_by_distance: true,
      clamp_to_ground: true,
      depth_test: true,
      url: "/example.png",
    },
  });
};
