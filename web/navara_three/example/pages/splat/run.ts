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
  height: 600,
};

// 約 0.001° ≒ 111m。0.0008° で ~88m 間隔。
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
};

// 4 体を東西一直線に等間隔で並べる (STEP は東西方向の lng 差)。
const SAMPLES: SplatSample[] = [
  {
    url: "https://sparkjs.dev/assets/splats/butterfly.spz",
    note: "SH3 / AA off",
    dLng: -1.5 * STEP,
    dLat: 0,
    scale: SCALE,
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
  },
  {
    url: "https://sparkjs.dev/assets/splats/penguin.spz",
    note: "SH3 / AA on",
    dLng: 1.5 * STEP,
    dLat: 0,
    scale: SCALE,
  },
];

// Spark の sample splat は Y-down (image-space) で訓練されているため、
// Y-up の世界では逆さまになる。X 軸 180° で flip してから surface normal に align する。
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
  const pos = geodeticToVector3({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height: CENTER.height,
  });
  const normal = geodeticSurfaceNormal({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height: CENTER.height,
  });

  const align = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    normal,
  );
  // 順序: flip (Y-down→Y-up) → yaw (object's up 軸まわり) → align (surface normal)
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

  // cat (SAMPLES[1]) を顔側 (北側) から見る。north 300m / up 100m。
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
