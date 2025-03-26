import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
  type LayerDescription,
} from "@navara/three";
import { AxesHelper, Sprite, SpriteMaterial } from "three";

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

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
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
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder:
        // @ts-expect-error : Make switch button later
        terrainType === "mapbox"
          ? MAPBOX_ELEVATION_DECODER()
          : JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  const pointLayer: LayerDescription = {
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
      size: 0.05,
      url: "/example.png",
    },
  };

  const point = view.addLayer(pointLayer);

  point.on("featureUpdated", (m, t) => {
    if (!(m instanceof Sprite && m.material instanceof SpriteMaterial)) {
      return;
    }
    m.material.opacity = Math.abs(Math.sin(t / 300));

    // TODO: Update material following properties
    // const batchIds = m.geometry.getAttribute("batch_id");
    // const evaluated = view.evaluateBatchedProperties(batchIds, (props) => {
    //   return [props.measuredHeight, /* props 1, props 2, props 3 */];
    // });
    // console.log(evaluated.get(0), evaluated.get(1));
  });

  view.on("preUpdate", (_t) => {
    // TODO: Update in an easier way.
    point.update({
      ...pointLayer,
      billboard: {
        ...pointLayer.billboard,
      },
    });
  });
};
