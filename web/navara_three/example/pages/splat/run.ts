import ThreeView, {
  geodeticToVector3,
  degreeToRadian,
  northUpEastToFixedFrame,
} from "@navara/three";
import type { SplatMeshDesc } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { SPLAT_DATASETS, TILE_DATASETS } from "../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

const CENTER = {
  lat: 35.71006,
  lng: 139.8107,
  // Place near the ground: with SCALE=30 each splat is ~30m tall, so dropping
  // by half-body keeps the feet on the surface.
  height: 10.0,
};

// 0.0008° of longitude ≈ 72m at Tokyo's latitude (35.71°N), since longitude
// degrees shrink by cos(lat). Latitude degrees stay ~111m/° regardless.
const STEP = 0.0008;
const SCALE = 30;

type SplatSample = {
  url: string;
  /** Short label used in the debug Pane. */
  name: string;
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
// URLs point to SparkJS's public demo assets — for production, host your own
// assets and respect the original splat dataset licenses.
const SAMPLES: SplatSample[] = [
  {
    url: SPLAT_DATASETS.sparkButterfly.url,
    name: "butterfly",
    note: "SH3 / AA off",
    dLng: -1.5 * STEP,
    dLat: 0,
    scale: SCALE,
    // butterfly: slightly above CENTER (20m) so the wings hover in the air.
    dHeight: 20,
  },
  {
    url: SPLAT_DATASETS.sparkCat.url,
    name: "cat",
    note: "SH3 / AA off",
    dLng: -0.5 * STEP,
    dLat: 0,
    scale: SCALE,
  },
  {
    url: SPLAT_DATASETS.sparkRobotHead.url,
    name: "robot-head",
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
    url: SPLAT_DATASETS.sparkPenguin.url,
    name: "penguin",
    note: "SH3 / AA on",
    dLng: 1.5 * STEP,
    dLat: 0,
    scale: SCALE,
  },
];

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
  // `northUpEastToFixedFrame` gives a local ENU frame at `pos` whose Y axis is
  // the surface normal. Spark's sample splats are trained Y-down so we flip
  // 180° around X within that frame; `sample.yaw` rotates around the local up.
  const matrix = northUpEastToFixedFrame(pos);

  view.addMesh<SplatMeshDesc>({
    matrixWorld: matrix,
    splat: {
      url: sample.url,
      lod: true,
    },
    rotation: { x: Math.PI, y: sample.yaw ?? -Math.PI / 2, z: 0 },
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

  showAttributions([
    TILE_DATASETS.openstreetmap,
    SPLAT_DATASETS.sparkButterfly,
    SPLAT_DATASETS.sparkCat,
    SPLAT_DATASETS.sparkRobotHead,
    SPLAT_DATASETS.sparkPenguin,
  ]);

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

  addDebugPane(view);
};

/**
 * Tweakpane readout of the camera's geographic pose and each splat's
 * intended `(lat, lng, height)`. Useful for visually checking whether the
 * rendered splats line up with the coordinates assigned by `SAMPLES`.
 */
const addDebugPane = (view: ThreeView<CustomDescriptions>): void => {
  const pane = new Pane({ title: "splat debug", expanded: true });

  const cameraState = {
    lat: 0,
    lng: 0,
    height: 0,
    heading: 0,
    pitch: 0,
  };

  const cameraFolder = pane.addFolder({ title: "camera", expanded: true });
  const cameraBindings = [
    cameraFolder.addBinding(cameraState, "lat", {
      readonly: true,
      format: (v: number) => v.toFixed(6),
    }),
    cameraFolder.addBinding(cameraState, "lng", {
      readonly: true,
      format: (v: number) => v.toFixed(6),
    }),
    cameraFolder.addBinding(cameraState, "height", {
      readonly: true,
      format: (v: number) => v.toFixed(2),
    }),
    cameraFolder.addBinding(cameraState, "heading", {
      readonly: true,
      format: (v: number) => v.toFixed(1),
    }),
    cameraFolder.addBinding(cameraState, "pitch", {
      readonly: true,
      format: (v: number) => v.toFixed(1),
    }),
  ];

  const splatsFolder = pane.addFolder({
    title: "splats (intended)",
    expanded: true,
  });
  for (const sample of SAMPLES) {
    const sub = splatsFolder.addFolder({ title: sample.name, expanded: false });
    const target = {
      note: sample.note,
      lat: CENTER.lat + sample.dLat,
      lng: CENTER.lng + sample.dLng,
      height: CENTER.height + (sample.dHeight ?? 0),
    };
    sub.addBinding(target, "note", { readonly: true });
    sub.addBinding(target, "lat", {
      readonly: true,
      format: (v: number) => v.toFixed(6),
    });
    sub.addBinding(target, "lng", {
      readonly: true,
      format: (v: number) => v.toFixed(6),
    });
    sub.addBinding(target, "height", {
      readonly: true,
      format: (v: number) => v.toFixed(2),
    });
  }

  view.on("postUpdate", () => {
    const geo = view.camera.positionGeographic;
    const ori = view.camera.orientation;
    cameraState.lat = geo.lat;
    cameraState.lng = geo.lng;
    cameraState.height = geo.height;
    cameraState.heading = ori.heading ?? 0;
    cameraState.pitch = ori.pitch ?? 0;
    for (const binding of cameraBindings) binding.refresh();
  });
};
