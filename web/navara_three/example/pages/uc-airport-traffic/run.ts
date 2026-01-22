import ThreeView, {
  ToneMappingMode,
  type ArclineMeshLayer,
  type GlowGlobeMeshLayer,
  Color,
  geodeticToVector3,
  degreeToRadian,
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

    // Calculate distance between src and dest using Vector3
    const srcVec = geodeticToVector3({
      lat: degreeToRadian(source.lat),
      lng: degreeToRadian(source.lng),
      height: 0,
    });
    const destVec = geodeticToVector3({
      lat: degreeToRadian(destination.lat),
      lng: degreeToRadian(destination.lng),
      height: 0,
    });
    const distance = srcVec.distanceTo(destVec);

    const trafficVolume = feature.properties.S10b_006;
    // Apply pseudo-log transformation: log(x + 1)
    const trafficVolumeLog = Math.log(trafficVolume + 1);
    const normalizedTraffic = trafficVolumeLog / maxTrafficLog;

    // Scale thickness based on traffic volume (0.5 to 3)
    const thickness = 1.2;

    // Get colors based on traffic volume using ColorMap
    const [r, g, b] = PLASMA_COLORMAP.linear(normalizedTraffic);
    const color = new Color().setRGB(r, g, b);
    const srcColor = color;
    const tgtColor = color;

    return {
      thickness,
      transparent: true,
      opacity: 0.3,
      segments: 64,
      height: 0,
      arcHeightScale: 0.3,
      srcColor,
      tgtColor,
      dashed: true,
      dashSize: 500000,
      dashOffset: Math.random() * 1000000,
      gapSize: 800000,
      geometry: [source, destination],
      distance, // Store distance for animation speed calculation
    };
  });

  return { arcLines };
};

export async function run() {
  const view = new ThreeView({
    backgroundColor: new Color().setStyle("#0b0a0d"),
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
    rasterTile: {
      maxZoom: 6,
      minZoom: 2,
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: LOCAL_DATASETS.blueMarbleNight.url,
    },
    rasterTile: {
      maxZoom: 6,
      minZoom: 1,
      opacity: 0.8,
    },
  });

  // Add globe glow mesh layer
  view.addLayer<GlowGlobeMeshLayer>({
    type: "mesh",
    glowGlobe: {
      radiusScale: 1.2,
      coefficient: 0.43,
      exponent: 50.0,
      glowColor: new Color().setStyle("#938cff"),
      opacity: 0.5,
    },
  });

  const { arcLines } = await constructData();

  const arcLineLayer = view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    arcLines,
  });

  // Dash animation - moves from src to dest
  // Speed is proportional to distance - longer routes animate faster
  const dashAnimFunc = () => {
    arcLines.forEach((arcLineDef) => {
      // Calculate speed based on distance (normalized and scaled)
      const baseSpeed = 5000;
      const distance = arcLineDef.distance || 1;
      const speedMultiplier = Math.sqrt(distance / 2000000);
      const speed = baseSpeed * speedMultiplier;

      arcLineDef.dashOffset = (arcLineDef.dashOffset ?? 0) + speed;
    });

    arcLineLayer.update({ arcLines });
    requestAnimationFrame(dashAnimFunc);
  };
  dashAnimFunc();

  showAttributions([
    LOCAL_DATASETS.blueMarbleNight,
    TILE_DATASETS.gsiSeamlessphoto,
    LOCAL_DATASETS.airportTrafficVolume,
  ]);
}
