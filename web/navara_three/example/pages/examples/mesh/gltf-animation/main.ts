import ThreeView, {
  degreeToRadian,
  eastNorthUpToFixedFrame,
  geodeticToVector3,
} from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";
import { Euler, Quaternion, Vector3 } from "three";

import { addButton } from "../../../../helpers/button";

const FOX = { lng: 137.6479, lat: 36.2517 };
const FOX_HEADING = 100;

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// The animation clips only advance while the view keeps rendering.
view.animation = true;

// Fixed sun + ambient fill so the model reads on the neutral basemap.
view.atmosphere.date = new Date("2026-07-16T02:00:00Z");
view.addLight({ ambient: { intensity: 0.6 } });
view.addLight({ sun: { intensity: 1.6 } });

view.setCamera({
  lng: FOX.lng,
  lat: FOX.lat,
  height: 5,
  distance: 50,
  heading: FOX_HEADING - 60,
  pitch: -35,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// With `matrixWorld` set to an ENU frame, rotation is an in-frame offset: in ENU
// up is +Z, so stand the Y-up model up (+90° about East), then yaw it about up.
const frameOrigin = geodeticToVector3({
  lng: degreeToRadian(FOX.lng),
  lat: degreeToRadian(FOX.lat),
  height: 0,
});
const matrixWorld = eastNorthUpToFixedFrame(frameOrigin);

const rotation = new Euler().setFromQuaternion(
  new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), -degreeToRadian(FOX_HEADING))
    .multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
    ),
);

const fox = view.addMesh<GLTFModelDesc>({
  gltfModel: {
    url: "/glTF/Fox/Fox.glb",
    animationEnabled: true,
    animationActiveClip: "Walk",
    animationLoop: true,
    animationAutoPlay: true,
    animationCrossfadeDuration: 0.4,
  },
  scale: { x: 0.12, y: 0.12, z: 0.12 },
  matrixWorld,
  rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
});

// Crossfade between the three clips the Fox model ships with.
const clips = ["Survey", "Walk", "Run"] as const;
let current: (typeof clips)[number] = "Walk";
const buttons = clips.map((clip) => {
  const button = addButton(clip);
  button.disabled = clip === current;
  button.onclick = () => {
    if (clip === current) return;
    fox.ref.crossFadeAnimation(current, clip, 0.4);
    current = clip;
    buttons.forEach((b, i) => (b.disabled = clips[i] === current));
  };
  return button;
});

view.attribution?.add([
  {
    attribution:
      "Fox by PixelMannen (CC0), rig & animation by tomkranis (CC BY 4.0) — Khronos glTF Sample Assets",
    attributionUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox",
  },
]);
