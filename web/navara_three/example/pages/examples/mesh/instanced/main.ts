import ThreeView, {
  Color,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import type {
  InstancedGltfModelMeshDesc,
  ModelChildConfig,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

const CITY = { lng: 139.7671, lat: 35.6812 };
const FIELD_RADIUS = 1000; // meters
const LANTERN_SCALE = 0.6;
const DENSITIES = [3_000, 5_000, 10_000];

const view = new ThreeView<DefaultDescriptions>({
  backgroundColor: new Color().setStyle("#0f1118"),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

view.addLight({ ambient: { intensity: 0.45 } });

view.setCamera({
  lng: 139.7625,
  lat: 35.6772,
  height: 60,
  heading: 34,
  pitch: -14,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/black/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// north-up-east frame at the city center: instance positions are x=north, z=east.
const matrixWorld = northUpEastToFixedFrame(
  geodeticToVector3({
    lng: degreeToRadian(CITY.lng),
    lat: degreeToRadian(CITY.lat),
    height: 0,
  }),
);

const generateLanterns = (count: number): ModelChildConfig[] => {
  const out: ModelChildConfig[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = FIELD_RADIUS * Math.sqrt(Math.random());
    out.push({
      position: { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r },
      rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
      scale: { x: LANTERN_SCALE, y: LANTERN_SCALE, z: LANTERN_SCALE },
    });
  }
  return out;
};

let density = DENSITIES[0];

const lanterns = view.addMesh<InstancedGltfModelMeshDesc>({
  gltfModels: {
    url: "/glTF/Lantern/Lantern.glb",
    emissiveColor: new Color().setStyle("#ffcc66"),
    emissiveIntensity: 3,
    children: generateLanterns(density),
  },
  matrixWorld,
});

const buttons = DENSITIES.map((n) => {
  const label = `${n / 1000}k`;
  const button = addButton(label);
  button.disabled = n === density;
  button.onclick = () => {
    density = n;
    lanterns.ref.replaceAll(generateLanterns(density));
    view.forceUpdate();
    buttons.forEach((b, i) => (b.disabled = DENSITIES[i] === density));
  };
  return button;
});

view.attribution?.add([
  {
    attribution:
      "Lantern by Microsoft & Frank Galligan (CC0) — Khronos glTF Sample Assets",
    attributionUrl:
      "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern",
  },
]);

initializeExample(view, [lanterns]);
