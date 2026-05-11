import ThreeView, {
  geodeticToVector3,
  degreeToRadian,
  geodeticSurfaceNormal,
} from "@navara/three";
import type { SplatMeshDesc } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector3, Quaternion, Euler } from "three";

import { TILE_DATASETS } from "../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

const CENTER = {
  lat: 35.71006,
  lng: 139.8107,
  // Place near the ground: with SCALE=30 each splat is ~30m tall, so dropping
  // by half-body keeps the feet on the surface.
  height: 10.0,
};

// 0.001° ≈ 111m, so 0.0008° gives ~88m spacing.
const STEP = 0.0008;
const SCALE = 30;

type SplatSample = {
  url: string;
  /** Comparison metadata — purely for reading the screenshots. */
  note: string;
  /** Offset from CENTER in degrees (lng east, lat north). */
  dLng: number;
  dLat: number;
  scale: number;
  /** Optional yaw rotation around the up axis (radians). */
  yaw?: number;
  /** Optional per-sample height delta [m]. Each splat has a different model
   * origin, so tune individually to land feet/center on the ground. */
  dHeight?: number;
};

// Four splats in an east-west line at equal spacing (STEP is the lng delta).
const SAMPLES: SplatSample[] = [
  {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    note: "SH3 / AA off",
    dLng: -1.5 * STEP,
    dLat: 0,
    scale: SCALE,
    // butterfly: slightly above CENTER (20m) so the wings hover in the air.
    dHeight: 20,
  },
  {
    url: "https://sparkjs.dev/assets/splats/cat.spz",
    note: "SH3 / AA off",
    dLng: -0.5 * STEP,
    dLat: 0,
    scale: SCALE,
  },
  {
    url: "https://sparkjs.dev/assets/splats/robot-head.spz",
    note: "SH3 / AA on",
    dLng: 0.5 * STEP,
    dLat: 0,
    scale: SCALE,
    yaw: Math.PI / 2,
    // robot-head: lifted above CENTER (20m) so it sits at roughly human face
    // height.
    dHeight: 20,
  },
  {
    url: "https://sparkjs.dev/assets/splats/penguin.spz",
    note: "SH3 / AA on",
    dLng: 1.5 * STEP,
    dLat: 0,
    scale: SCALE,
  },
];

// Spark's sample splats are trained in Y-down (image-space) convention, so they
// appear upside-down in a Y-up world. Flip 180° around X first, then align with
// the surface normal.
const FLIP_Y_DOWN = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  Math.PI,
);

const placeSplat = (
  view: ThreeView<CustomDescriptions>,
  sample: SplatSample,
) => {
  const lat = CENTER.lat + sample.dLat;
  const lng = CENTER.lng + sample.dLng;
  const height = CENTER.height + (sample.dHeight ?? 0);
  const pos = geodeticToVector3({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height,
  });
  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height,
  });

  const align = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    normal,
  );
  // Order: flip (Y-down→Y-up) → yaw (around the object's up axis) → align
  // (surface normal).
  const yaw = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    sample.yaw ?? 0,
  );
  const euler = new Euler().setFromQuaternion(
    align.clone().multiply(yaw).multiply(FLIP_Y_DOWN),
  );

  view.addMesh<SplatMeshDesc>({
    splat: {
      url: sample.url,
      lod: true,
    },
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
    scale: { x: sample.scale, y: sample.scale, z: sample.scale },
  });
};

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  plugin.addDefaultPhotorealScene();

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  for (const sample of SAMPLES) {
    placeSplat(view, sample);
  }

  // View the cat (SAMPLES[1]) from its front (north) side: 300m north, 100m up.
  const focus = SAMPLES[1];
  view.lookAt(
    {
      lat: CENTER.lat + focus.dLat,
      lng: CENTER.lng + focus.dLng,
      height: CENTER.height,
    },
    new Vector3(0, 300, 100),
  );
};
