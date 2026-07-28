import ThreeView, { Color } from "@navaramap/three";
import type { GlowGlobeMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";

import { initializeExample } from "../../../../helpers/initialize";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Large enough that the globe dominates the frame while the glow ring still
// clears the edges.
view.setCamera({
  lng: 15,
  lat: 30,
  height: 8_500_000,
  heading: 0,
  pitch: -90,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/blackmarble/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

view.addMesh<GlowGlobeMeshDesc>({
  glowGlobe: {
    radiusScale: 1.08,
    coefficient: 0.35,
    exponent: 6,
    glowColor: new Color().setHex(0x4aa8ff),
    opacity: 0.9,
  },
});

initializeExample(view);
