import ThreeView, {
  ToneMappingMode,
  type ArclineMeshLayer,
  Color,
} from "@navara/three";
import type { FeatureCollection, MultiLineString } from "geojson";

import { showAttributions } from "../../helpers/attributions";
import { PLASMA_COLORMAP } from "../../helpers/colors";
import { LOCAL_DATASETS, TILE_DATASETS } from "../../helpers/constants";

type AirportTrafficData = FeatureCollection<
  MultiLineString,
  {
    S10b_001: string; // Source airport
    S10b_004: string; // Destination airport
    S10b_005: number; // Distance
    S10b_006: number; // Number of flights
    S10b_007: number; // Passengers
    S10b_008: number; // Total traffic volume
    S10b_009: number; // Freight
  }
>;

const constructData = async () => {
  // Fetch and process airport traffic data
  const response = await fetch(LOCAL_DATASETS.airportTrafficVolume.url);
  const data: AirportTrafficData = await response.json();

  // Find the maximum traffic volume for normalization with pseudo-log
  const maxTrafficLog = Math.max(
    ...data.features.map((f) => Math.log(f.properties.S10b_006 + 1)),
  );

  // Convert GeoJSON features to arc line definitions
  const arcLines = data.features.map((feature) => {
    const coords = feature.geometry.coordinates[0];
    const source = { lng: coords[0][0], lat: coords[0][1] };
    const destination = { lng: coords[1][0], lat: coords[1][1] };

    const trafficVolume = feature.properties.S10b_006;
    // Apply pseudo-log transformation: log(x + 1)
    const trafficVolumeLog = Math.log(trafficVolume + 1);
    const normalizedTraffic = trafficVolumeLog / maxTrafficLog;

    // Scale thickness based on traffic volume (0.5 to 3)
    const thickness = 1.5;

    // Get colors based on traffic volume using ColorMap
    const [r, g, b] = PLASMA_COLORMAP.linear(normalizedTraffic);
    const color = new Color().setRGB(r, g, b);
    const srcColor = color.raw.getHex();
    const tgtColor = color.raw.getHex();

    return {
      thickness,
      transparent: true,
      opacity: 0.3,
      segments: 64,
      height: 0,
      arcHeightScale: 0.3,
      srcColor,
      tgtColor,
      geometry: [source, destination],
    };
  });

  return { arcLines };
};

export async function run() {
  const view = new ThreeView({
    backgroundColor: 0x0b0a0d,
  });

  await view.init();

  view.atmosphere.date.setHours(8);

  view.toneMappingExposure = 10;

  view.addLayer({
    type: "light",
    ambient: {},
  });

  view.addLayer({
    type: "mesh",
    sky: {},
  });

  view.addLayer({
    type: "mesh",
    stars: {
      intensity: 100,
      pointSize: 1.5,
    },
  });

  view.addLayer({
    type: "effect",
    toneMapping: {
      mode: ToneMappingMode.REINHARD2,
    },
  });
  view.addLayer({
    type: "effect",
    smaa: {
      quality: "ultra",
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_DATASETS.gsiSeamlessphoto.url,
    },
    raster_tile: {
      max_zoom: 6,
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: LOCAL_DATASETS.blueMarbleNight.url,
    },
    raster_tile: {
      max_zoom: 6,
      opacity: 0.8,
    },
  });

  const { arcLines } = await constructData();

  view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    arcLines,
  });

  showAttributions([
    LOCAL_DATASETS.blueMarbleNight,
    TILE_DATASETS.gsiSeamlessphoto,
    LOCAL_DATASETS.airportTrafficVolume,
  ]);
}
