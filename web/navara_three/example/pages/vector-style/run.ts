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

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scene.add(axesHelper);

  // view.effectComposer.addPass(
  //   new EffectPass(
  //     this.camera,
  //     new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
  //   ),
  // );

  view.addLayer({
    type: "tiles",
    data: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    },
    raster_tile: {
      segments: 10,
      color: 0xffffff,
      max_sse: 2,
      max_zoom: 23,
      wireframe: false,
    },
  });

  const terrainType: "mapbox" | "gsi" = "gsi";

  // view.addLayer({
  //   type: "terrain",
  //   data: {
  //     // @ts-expect-error : Make switch button later
  //     url: terrainType === "mapbox" ? terrainUrls.mapbox : terrainUrls.gsi,
  //   },
  //   raster_terrain: {
  //     segments: 64,
  //     max_zoom: 15,
  //     min_zoom: 5,
  //     wireframe: false,
  //     elevation_decoder:
  //       // @ts-expect-error : Make switch button later
  //       terrainType === "mapbox"
  //         ? MAPBOX_ELEVATION_DECODER()
  //         : JAPAN_GSI_ELEVATION_DECODER(),
  //   },
  // });

  view.addLayer({
    type: "mvt",
    data: {
      url: `${location.origin}/data/chuo_mvt/{z}/{x}/{y}.pbf`,
    },
    vector_tile: {
      max_zoom: 16,
    },
    polygon: {
      color: 0xffffff,
      clamp_to_ground: false,
      height: 1,
    },
  });
  view.addLayer({
    type: "mvt",
    data: {
      url: `${location.origin}/data/chiyoda_mvt/{z}/{x}/{y}.pbf`,
    },
    vector_tile: {
      max_zoom: 16,
    },
    polygon: {
      color: 0xffffff,
      clamp_to_ground: false,
      height: 1,
    },
  });
};
