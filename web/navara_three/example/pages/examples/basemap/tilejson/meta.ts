import type { ExampleMeta } from "../../sections";

export default {
  section: "basemap",
  order: 4,
  title: { en: "TileJSON", ja: "TileJSON" },
  description: {
    en: "Display a basemap from TileJSON.",
    ja: "TileJSON からベースマップを表示する。",
  },
  docs: "three/source/raster-tile-source",
} satisfies ExampleMeta;
