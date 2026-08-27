import type ThreeView from "@navaramap/three";
import {
  MeshHandle,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import { Pane } from "tweakpane";

import { TERRAIN_DATASETS } from "../../../helpers/constants";
import { addHidePaneKeyShortcut } from "../../../helpers/control";

import { SUBJECTS, type Subject, type Transform } from "./subjects";

/** Mountainous terrain, so `heightReference: "terrain"` has something to bite on. */
const SITE = { lng: 138.036142, lat: 36.085621 };
/**
 * Terrain height at SITE, in metres. Only the camera anchor and the
 * bare-ECEF subject use it — the ground slopes ~40 m across the row, so
 * anything placed off-centre samples its own height.
 */
const SITE_TERRAIN = 910;
/** Metres between adjacent subjects along the east axis. */
const SPACING = 24;
/** Metres each column sits north (geodetic) or south (legacy) of the centre line. */
const COLUMN_OFFSET = 40;

const metresToLat = (m: number) => m / 110_574;
const metresToLng = (m: number, lat: number) =>
  m / (111_320 * Math.cos(degreeToRadian(lat)));

/** A subject paired with the handle of one of its two placements. */
type Placed = { subject: Subject; handle: MeshHandle };

export const run = async (view: ThreeView<DefaultDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const tilejson = new TileJsonPlugin();
  view.addPlugin(tilejson);

  await view.init();

  view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
  view.addLight({ ambient: { intensity: 1.2 } });
  view.addLight({ sun: { intensity: 2 } });

  const terrain = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 18,
    requestVertexNormals: true,
  });
  view.addLayer({ type: "terrain", source: terrain });

  const basemap = await tilejson.addSource({
    type: "raster-tile",
    url: "https://papers.reearth.land/styles/black/tilejson.json",
  });
  view.addLayer({ type: "raster", source: basemap });

  // Annotated rather than inferred: tweakpane's `addBinding` mutates these
  // fields, and a bare object literal would widen `heightReference` to
  // `string`, which `geodetic` will not accept.
  const placement: {
    heading: number;
    pitch: number;
    roll: number;
    scale: number;
    height: number;
    heightReference: "ellipsoid" | "terrain";
  } = {
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    height: 0,
    heightReference: "terrain",
  };

  // The pre-geodetic placement API: offsets and rotations expressed inside the
  // `matrixWorld` frame. `northUpEastToFixedFrame` is +X north, +Y up, +Z east.
  const legacy = {
    north: 0,
    up: 0,
    east: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scale: 1,
  };

  /** East offset of subject `i`, centred on SITE. */
  const eastOf = (i: number) => (i - (SUBJECTS.length - 1) / 2) * SPACING;

  const siteOf = (i: number, northOffset: number) => ({
    lng: SITE.lng + metresToLng(eastOf(i), SITE.lat),
    lat: SITE.lat + metresToLat(northOffset),
  });

  const geodeticColumn: Placed[] = [];
  const legacyColumn: Placed[] = [];

  // The pre-geodetic API has no `heightReference`, so putting the legacy column
  // on the ground means sampling terrain by hand first. `sampleTerrainMostDetailed`
  // fetches the source's max-LOD tiles regardless of where the camera is,
  // unlike the synchronous `sampleTerrainHeight`. That sample is also a
  // one-shot: unlike the geodetic column, this column does not re-place itself
  // when terrain refines.
  const legacyGround = await view.sampleTerrainMostDetailed(
    terrain,
    SUBJECTS.map((_, i) => {
      // `northUpEastToFixedFrame` is +X north / +Y up / +Z east, where
      // `geodetic`'s West-Up-North frame is +X west / +Y up / +Z north. Local
      // geometry therefore points 90 degrees apart between the columns until
      // "match geodetic heading" is pressed — most legible on `tube`, whose arch
      // spans east-west in one column and north-south in the other.
      const site = siteOf(i, -COLUMN_OFFSET);
      return {
        lng: site.lng,
        lat: site.lat,
      };
    }),
  );

  SUBJECTS.forEach((subject, i) => {
    // `geodetic` occupies the `matrixWorld` slot, and `position` stays an
    // offset *inside* the resulting frame — which is what lifts each mesh out
    // of the ground here (`frame · T · R · S`).
    const geodeticTransform: Transform = {
      geodetic: { ...siteOf(i, COLUMN_OFFSET), ...placement },
      position: { x: 0, y: subject.lift, z: 0 },
    };
    geodeticColumn.push({
      subject,
      handle: view.addMesh(subject.config(geodeticTransform)),
    });

    // `northUpEastToFixedFrame` is +X north / +Y up / +Z east, where
    // `geodetic`'s West-Up-North frame is +X west / +Y up / +Z north. Local
    // geometry therefore points 90 degrees apart between the columns until
    // "match geodetic heading" is pressed — most legible on `tube`, whose arch
    // spans east-west in one column and north-south in the other.
    const site = siteOf(i, -COLUMN_OFFSET);
    const legacyTransform: Transform = {
      matrixWorld: northUpEastToFixedFrame(
        geodeticToVector3({
          lng: site.lng,
          lat: site.lat,
          height: legacyGround[i].height ?? SITE_TERRAIN,
        }),
      ),
      position: {
        x: legacy.north,
        y: subject.lift + legacy.up,
        z: legacy.east,
      },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: legacy.scale, y: legacy.scale, z: legacy.scale },
    };
    legacyColumn.push({
      subject,
      handle: view.addMesh(subject.config(legacyTransform)),
    });
  });

  const overview = () => {
    view.setCamera({
      lng: SITE.lng,
      lat: SITE.lat,
      height: SITE_TERRAIN,
      distance: 340,
      heading: 0,
      pitch: -50,
      roll: 0,
    });
  };
  overview();

  const applyGeodetic = () => {
    geodeticColumn.forEach(({ subject, handle }) => {
      if (!subject.placementUpdatable) return;
      // Partial merge: the stored lng/lat survive, only these fields change.
      handle.update({ geodetic: { ...placement } });
    });
    view.forceUpdate();
  };

  const applyLegacy = () => {
    legacyColumn.forEach(({ subject, handle }) => {
      if (!subject.placementUpdatable) return;
      handle.update({
        position: {
          x: legacy.north,
          y: subject.lift + legacy.up,
          z: legacy.east,
        },
        rotation: {
          x: degreeToRadian(legacy.rotX),
          y: degreeToRadian(legacy.rotY),
          z: degreeToRadian(legacy.rotZ),
        },
        scale: { x: legacy.scale, y: legacy.scale, z: legacy.scale },
      });
    });
    view.forceUpdate();
  };

  const pane = new Pane({ title: "geodetic placement" });
  addHidePaneKeyShortcut(pane);

  const geodeticFolder = pane.addFolder({ title: "geodetic (north column)" });
  geodeticFolder
    .addBinding(placement, "heading", { min: 0, max: 360, step: 1 })
    .on("change", applyGeodetic);
  geodeticFolder
    .addBinding(placement, "pitch", { min: -90, max: 90, step: 1 })
    .on("change", applyGeodetic);
  geodeticFolder
    .addBinding(placement, "roll", { min: -180, max: 180, step: 1 })
    .on("change", applyGeodetic);
  geodeticFolder
    .addBinding(placement, "scale", { min: 0.2, max: 5, step: 0.1 })
    .on("change", applyGeodetic);
  geodeticFolder
    .addBinding(placement, "height", { min: -20, max: 200, step: 1 })
    .on("change", applyGeodetic);
  geodeticFolder
    .addBinding(placement, "heightReference", {
      label: "heightRef",
      options: { ellipsoid: "ellipsoid", terrain: "terrain" },
    })
    .on("change", applyGeodetic);

  const legacyFolder = pane.addFolder({ title: "legacy (south column)" });
  (["north", "up", "east"] as const).forEach((axis) => {
    legacyFolder
      .addBinding(legacy, axis, { min: -30, max: 30, step: 1 })
      .on("change", applyLegacy);
  });
  (["rotX", "rotY", "rotZ"] as const).forEach((axis) => {
    legacyFolder
      .addBinding(legacy, axis, { min: -180, max: 180, step: 1 })
      .on("change", applyLegacy);
  });
  legacyFolder
    .addBinding(legacy, "scale", { min: 0.2, max: 5, step: 0.1 })
    .on("change", applyLegacy);
  legacyFolder
    .addButton({ title: "match geodetic heading" })
    .on("click", () => {
      // In the NUE frame a glTF front (+Z) starts pointing east, and
      // `Ry(theta)` sends +Z to `(sin theta, 0, cos theta)` = (north, up, east).
      // A bearing `h` is `(cos h, 0, sin h)`, so `theta = 90 - h` — the hand
      // math that `geodetic`'s `heading` replaces. Both columns should end up
      // facing the same way.
      legacy.rotY = 90 - placement.heading;
      pane.refresh();
      applyLegacy();
    });

  view.attribution?.add([
    TERRAIN_DATASETS.reearthQuantizedMesh,
    {
      attribution: "Classic Muscle car by Lexyc16 (CC BY 4.0)",
      attributionUrl:
        "https://sketchfab.com/3d-models/classic-muscle-car-641efc889e5f4543bae51d0922e6f4b3",
    },
    {
      attribution:
        "Lantern by Microsoft & Frank Galligan (CC0) — Khronos glTF Sample Assets",
      attributionUrl:
        "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern",
    },
  ]);
};
