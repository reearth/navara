import ThreeView from "@navaramap/three";
import { type ColorGradingLUTEffectDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

import { addSwitch } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";
import { GOOGLE_MAPS_API_KEY } from "../../../../helpers/keys";

const LOOKS: {
  label: string;
  lut?: { url: string; attribution: string; attributionUrl?: string };
}[] = [
  {
    label: "Cinematic",
    lut: {
      url: "https://raw.githubusercontent.com/pmndrs/postprocessing/refs/heads/main/demo/static/textures/lut/3dl/presetpro-cinematic.3dl",
      attribution:
        "(C) Copyright 2018 https://www.presetpro.com and Tim Martin",
      attributionUrl: "https://www.presetpro.com",
    },
  },
  {
    label: "Warm film",
    lut: {
      url: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/1a932c055ea624b14816f40fc321e95a3a98dfce/storybook/assets/clut/Fuji/Fuji%20160C%202.png",
      attribution: "Fuji 160C - RawTherapee",
      attributionUrl: "https://rawpedia.rawtherapee.com/Film_Simulation",
    },
  },
  {
    label: "Cool film",
    lut: {
      url: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/1a932c055ea624b14816f40fc321e95a3a98dfce/storybook/assets/clut/Agfa/Agfa%20Vista%20200.png",
      attribution: "Agfa Vista 200 - RawTherapee",
      attributionUrl: "https://rawpedia.rawtherapee.com/Film_Simulation",
    },
  },
  { label: "Original" },
];

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

await view.init();

const defaultScene = defaultPlugin.addDefaultPhotorealScene();
defaultScene.aerialPerspective.update({
  aerialPerspective: { irradiance: true },
});
view.toneMappingExposure = 20;
view.atmosphere.date = new Date("2026-07-01T18:10:00Z");

view.setCamera({
  lng: 2.176939,
  lat: 41.405505,
  distance: 560,
  heading: 309,
  pitch: -14,
  roll: 0,
});

const tilesSource = view.addSource({
  type: "3d-tiles",
  url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
    GOOGLE_MAPS_API_KEY,
  )}`,
});
const tiles = view.addLayer({
  type: "3d-tiles",
  source: tilesSource,
  model: { maxSse: 8, normals: true },
});

const grading = view.addEffect<ColorGradingLUTEffectDesc>({
  colorGradingLUT: { url: LOOKS[0].lut?.url },
  visible: true,
});

let credited = LOOKS[0].lut;
addSwitch(
  LOOKS.map((look) => look.label),
  0,
  (index) => {
    const look = LOOKS[index];
    if (look.lut) {
      grading.update({ visible: true, colorGradingLUT: { url: look.lut.url } });
    } else {
      grading.update({ visible: false });
    }
    if (credited) view.attribution?.remove([credited]);
    credited = look.lut;
    if (credited) view.attribution?.add([credited]);
  },
  { align: "right" },
);

view.attribution?.add([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    attributionUrl: "https://www.google.com/permissions/geoguidelines/",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: tiles.id,
  },
  ...(credited ? [credited] : []),
]);

initializeExample(view);
