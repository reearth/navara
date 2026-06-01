import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { AstroTime, Body, Equator, Horizon, Observer } from "astronomy-engine";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

const LOCATIONS = [
  {
    name: "Tokyo",
    lng: 139.69,
    lat: 35.68,
    height: 500,
    distance: 15000,
    heading: 20,
    pitch: -25,
  },
  {
    name: "London",
    lng: -0.12,
    lat: 51.5,
    height: 500,
    distance: 12000,
    heading: 0,
    pitch: -25,
  },
  {
    name: "New York",
    lng: -74.01,
    lat: 40.71,
    height: 500,
    distance: 12000,
    heading: 330,
    pitch: -25,
  },
  {
    name: "Sydney",
    lng: 151.21,
    lat: -33.87,
    height: 500,
    distance: 12000,
    heading: 0,
    pitch: -25,
  },
  {
    name: "Dubai",
    lng: 55.27,
    lat: 25.2,
    height: 500,
    distance: 15000,
    heading: 10,
    pitch: -25,
  },
] as const;

function formatHHMM(decimalHours: number): string {
  const h = Math.floor(decimalHours) % 24;
  const m = Math.round((decimalHours - Math.floor(decimalHours)) * 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const run = async (view: ThreeView<CustomDescriptions>) => {
  view.addPlugin(new DefaultPlugin());
  await view.init();

  view.toneMappingExposure = 3;
  view.addEffect({ toneMapping: { mode: ToneMappingMode.NEUTRAL } });
  view.addEffect({ smaa: {} });
  view.addLight({ sun: { intensity: 1 } });
  view.addMesh({ sky: {} });
  view.addLight({ ambient: { intensity: 0.1 } });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.mapterhorn.url },
    rasterTile: { maxZoom: 17, minZoom: 5 },
    hillshade: {
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      exaggeration: 1.0,
    },
  });

  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.mapterhorn.url },
    rasterTerrain: {
      maxZoom: 17,
      minZoom: 5,
      elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
      tileSize: 512,
    },
  });

  // Start over Tokyo with 8 AM local solar time (UTC = 8 - 139.69/15)
  const solarTarget = 8.0;
  const initialUtcH = (((solarTarget - LOCATIONS[0].lng / 15) % 24) + 24) % 24;
  const initialDate = new Date("2024-06-21T00:00:00Z");
  initialDate.setUTCHours(
    Math.floor(initialUtcH),
    Math.round((initialUtcH % 1) * 60),
    0,
    0,
  );
  view.atmosphere.date = initialDate;

  view.setCamera({
    lng: LOCATIONS[0].lng,
    lat: LOCATIONS[0].lat,
    height: LOCATIONS[0].height,
    distance: LOCATIONS[0].distance,
    heading: LOCATIONS[0].heading,
    pitch: LOCATIONS[0].pitch,
    roll: 0,
  });

  const pane = new Pane();

  // Info panel — shows current solar time and elevation at camera position
  const info = {
    solarTime: "08:00",
    elevation: "0.0°",
    utc: initialDate.toISOString().slice(11, 16),
  };
  const infoFolder = pane.addFolder({ title: "Sun at camera" });
  const solarMonitor = infoFolder.addBinding(info, "solarTime", {
    readonly: true,
    label: "Solar time",
  });
  const elevMonitor = infoFolder.addBinding(info, "elevation", {
    readonly: true,
    label: "Elevation",
  });
  const utcMonitor = infoFolder.addBinding(info, "utc", {
    readonly: true,
    label: "UTC",
  });

  view.on("postUpdate", () => {
    const d = view.atmosphere.date;
    const { lng, lat } = view.camera.positionGeographic;
    const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;

    info.solarTime = formatHHMM((((utcH + lng / 15) % 24) + 24) % 24);
    info.utc = d.toISOString().slice(11, 16);

    const time = new AstroTime(d);
    const observer = new Observer(lat, lng, 0);
    const eq = Equator(Body.Sun, time, observer, true, true);
    const elevDeg = Horizon(time, observer, eq.ra, eq.dec, "normal").altitude;
    info.elevation = `${elevDeg.toFixed(1)}°`;

    solarMonitor.refresh();
    elevMonitor.refresh();
    utcMonitor.refresh();
  });

  const flyTo = (loc: (typeof LOCATIONS)[number]) => {
    view.setCamera({
      lng: loc.lng,
      lat: loc.lat,
      height: loc.height,
      distance: loc.distance,
      heading: loc.heading,
      pitch: loc.pitch,
      roll: 0,
    });
  };

  // setDateFromCameraAt: maintains local solar time (hour angle) across locations
  const solarTimeFolder = pane.addFolder({
    title: "Match solar time (setDateFromCameraAt)",
  });
  for (const loc of LOCATIONS) {
    solarTimeFolder.addButton({ title: loc.name }).on("click", () => {
      view.atmosphere.setDateFromCameraAt({ lng: loc.lng });
      flyTo(loc);
    });
  }

  // setElevationFromCameraAt: maintains sun elevation angle across locations
  const elevFolder = pane.addFolder({
    title: "Match elevation (setElevationFromCameraAt)",
  });
  for (const loc of LOCATIONS) {
    elevFolder.addButton({ title: loc.name }).on("click", () => {
      view.atmosphere.setElevationFromCameraAt({ lng: loc.lng, lat: loc.lat });
      flyTo(loc);
    });
  }

  showAttributions([TERRAIN_DATASETS.mapterhorn, TILE_DATASETS.openstreetmap]);
};
