import ThreeView, { Color, type LatLng } from "@navaramap/three";
import type { ArclineMeshDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../../helpers/control";

// Fixed anchor for the first endpoint (Tokyo). The second endpoint is placed a
// controllable geodesic distance east of it, so the whole reproduction is a
// single arc whose chord length we can sweep down to sub-meter separations.
const ANCHOR: LatLng = { lng: 139.767125, lat: 35.681236 };

// Mean Earth radius (m) — good enough to convert a meters slider into a
// destination lng/lat for a short east-bound offset.
const EARTH_RADIUS = 6371000;

/**
 * Geodesic destination point a given distance (m) from `origin` along `bearing`
 * (radians, clockwise from north). Standard spherical forward formula.
 */
const destination = (
  origin: LatLng,
  distanceMeters: number,
  bearing: number,
): LatLng => {
  const delta = distanceMeters / EARTH_RADIUS; // angular distance
  const phi1 = (origin.lat * Math.PI) / 180;
  const lambda1 = (origin.lng * Math.PI) / 180;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
    );

  return { lng: (lambda2 * 180) / Math.PI, lat: (phi2 * 180) / Math.PI };
};

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({ debug: true });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const attribution = view.attribution;

  await view.init();

  // Base map only — no lights needed for the unlit arc / raster tiles.
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 19 },
  });

  // --- Reproduction parameters (driven by the UI) ---
  const PARAMS = {
    distance: 1000, // meters between the two endpoints
    bearing: 90, // direction of the second endpoint (deg, 90 = east)
    arcHeightScale: 0.3,
    thickness: 4,
    segments: 64,
  };

  const endpoints = (): [LatLng, LatLng] => [
    ANCHOR,
    destination(ANCHOR, PARAMS.distance, (PARAMS.bearing * Math.PI) / 180),
  ];

  const arc = view.addMesh<ArclineMeshDesc>({
    arcLines: [
      {
        thickness: PARAMS.thickness,
        segments: PARAMS.segments,
        arcHeightScale: PARAMS.arcHeightScale,
        srcColor: new Color().setHex(0x00ffaa),
        tgtColor: new Color().setHex(0xff6600),
        geometry: endpoints(),
      },
    ],
  });

  // Frame the camera on the arc, pulling back proportionally to the separation
  // so it stays visible from a sub-meter gap to hundreds of km. The eye is
  // placed south of the midpoint and tilted north-down so the arc (and its
  // lift) sits in the center of the view rather than directly under the camera.
  const frameCamera = () => {
    const [p1, p2] = endpoints();
    const mid = { lng: (p1.lng + p2.lng) / 2, lat: (p1.lat + p2.lat) / 2 };
    // Keep a floor so tiny separations don't drop the camera into the ground.
    const height = Math.max(PARAMS.distance * 1.5, 300);
    // At pitch -45 the look direction meets the ground ~`height` ahead, so
    // offsetting the eye `height` to the south (bearing 180°) centers the arc.
    const eye = destination(mid, height, Math.PI);
    view.setCamera({
      lng: eye.lng,
      lat: eye.lat,
      height,
      heading: 0,
      pitch: -45,
      roll: 0,
    });
  };
  frameCamera();

  const rebuildArc = () => {
    arc.update({
      arcLines: [
        {
          thickness: PARAMS.thickness,
          segments: PARAMS.segments,
          arcHeightScale: PARAMS.arcHeightScale,
          geometry: endpoints(),
        },
      ],
    });
  };

  // --- UI ---
  const pane = new Pane({ title: "Arcline: near points" });

  pane
    .addBinding(PARAMS, "distance", {
      label: "distance (m)",
      min: 0.1,
      max: 500000,
      step: 10,
    })
    .on("change", () => {
      rebuildArc();
    });

  pane
    .addBinding(PARAMS, "bearing", { label: "bearing (deg)", min: 0, max: 360 })
    .on("change", () => {
      rebuildArc();
    });

  pane
    .addBinding(PARAMS, "arcHeightScale", { min: 0, max: 1, step: 0.01 })
    .on("change", rebuildArc);

  pane
    .addBinding(PARAMS, "thickness", { min: 0.5, max: 20, step: 0.5 })
    .on("change", rebuildArc);

  pane
    .addBinding(PARAMS, "segments", { min: 2, max: 256, step: 1 })
    .on("change", rebuildArc);

  pane.addButton({ title: "Re-frame camera" }).on("click", frameCamera);

  addHidePaneKeyShortcut(pane);

  attribution?.add([TILE_DATASETS.openstreetmap]);
};

run();
