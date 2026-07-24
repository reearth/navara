import ThreeView, { Color } from "@navaramap/three";
import type { GlowGlobeMeshDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

const view = new ThreeView<DefaultDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

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
