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
import { AttributionPlugin } from "@navara/three_plugins";
import { Pane } from "tweakpane";

import { SPLAT_DATASETS, TILE_DATASETS } from "../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

// Tokyo Station — a visible landmark on the OSM base tiles.
const CENTER = {
  lat: 35.6812,
  lng: 139.7671,
  height: 30.0,
};

type SplatSample = {
  url: string;
  /** Folder title in the debug pane. */
  name: string;
  /** Free-form note shown in the debug pane. */
  note: string;
  /** Offset from CENTER in degrees (lng east, lat north). */
  dLng: number;
  dLat: number;
  scale: number;
  /** Optional yaw rotation around the up axis (radians). */
  yaw?: number;
  /** Optional per-sample height delta [m]. */
  dHeight?: number;
  /**
   * Optional camera distance [m] used by the folder's "Fly to" button to frame
   * the model. Defaults to 100 m (see {@link flyDistance}).
   */
  viewDistance?: number;
  /** Optional camera heading [deg] for "Fly to" (0 = looking north). */
  viewHeading?: number;
  /** Optional camera pitch [deg] for "Fly to" (negative looks down). */
  viewPitch?: number;
};

/** Camera distance (m) that frames a sample, proportional to its scale. */
const flyDistance = (sample: SplatSample): number => sample.viewDistance ?? 100;

/** A 3/4 down-looking view by default; per-sample overrides win. */
const DEFAULT_VIEW_HEADING = -25;
const DEFAULT_VIEW_PITCH = -20;

/** Camera pose that frames a sample — shared by the initial view and "Fly to". */
const sampleCamPos = (sample: SplatSample) => ({
  lng: CENTER.lng + sample.dLng,
  lat: CENTER.lat + sample.dLat,
  height: CENTER.height + (sample.dHeight ?? 0),
  distance: flyDistance(sample),
  heading: sample.viewHeading ?? DEFAULT_VIEW_HEADING,
  pitch: sample.viewPitch ?? DEFAULT_VIEW_PITCH,
});

const SAMPLES: SplatSample[] = [
  {
    url: SPLAT_DATASETS.quechua.url,
    name: "quechua",
    note: "QUECHUA - Webviewer by Christoph SCHINDELAR",
    dLng: -0.0012,
    dLat: 0,
    scale: 1,
  },
  {
    url: SPLAT_DATASETS.pencilSharpener.url,
    name: "pencil-sharpener",
    note: "Pencil sharpener shaped like a duck by Alfred Duemlein",
    dLng: 0.0028,
    dLat: 0,
    scale: 20,
  },
  {
    // ~1800 km east of CENTER: exercises the dynamic RTC origin — flying here
    // should be as jitter-free as CENTER (a single static origin could not do both).
    url: SPLAT_DATASETS.quechua.url,
    name: "quechua-far",
    note: "QUECHUA (far copy, ~1800 km east) — dynamic-origin jitter test",
    dLng: 20,
    dLat: 0,
    scale: 1,
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
  // NUE frame at `pos` (Y = surface normal). Flip 180° around X for Y-down
  // assets; `sample.yaw` rotates around the local up.
  const matrix = northUpEastToFixedFrame(pos);

  return view.addMesh<SplatMeshDesc>({
    matrixWorld: matrix,
    splat: {
      url: sample.url,
      lod: false,
    },
    rotation: { x: Math.PI, y: sample.yaw ?? -Math.PI / 2, z: 0 },
    scale: { x: sample.scale, y: sample.scale, z: sample.scale },
  });
};

type SplatHandle = ReturnType<typeof placeSplat>;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);

  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  plugin.addDefaultPhotorealScene();

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  attribution.add([
    TILE_DATASETS.openstreetmap,
    SPLAT_DATASETS.quechua,
    SPLAT_DATASETS.pencilSharpener,
  ]);

  const handles = new Map<SplatSample, SplatHandle>();
  for (const sample of SAMPLES) {
    handles.set(sample, placeSplat(view, sample));
  }

  // Start from the same framing as quechua's "Fly to" (instant, no animation).
  const quechua = SAMPLES.find((s) => s.name === "quechua") ?? SAMPLES[0];
  view.setCamera(sampleCamPos(quechua));

  addDebugPane(view, handles);
};

/** Tweakpane debug pane: camera pose + each splat's intended position. */
const addDebugPane = (
  view: ThreeView<CustomDescriptions>,
  handles: Map<SplatSample, SplatHandle>,
): void => {
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

    // Live uniform-scale control. Splats are placed with a `matrixWorld` frame,
    // so the update recomposes frame · rotation · scale and the RTC controller
    // re-tracks it — no reload needed. High scales show sort "boiling".
    const scaleParams = { scale: sample.scale };
    sub
      .addBinding(scaleParams, "scale", { min: 0.1, max: 20, step: 0.1 })
      .on("change", (ev) => {
        handles.get(sample)?.update({
          scale: { x: ev.value, y: ev.value, z: ev.value },
        });
      });

    sub.addButton({ title: "Fly to" }).on("click", () => {
      // Keep `height` (the model sits ~30 m up) and use `distance` to frame it:
      // the camera stops `distance` m from the target along its forward ray,
      // oriented by heading/pitch so the model is framed rather than edge-on.
      view.flyTo(sampleCamPos(sample), 1000);
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
