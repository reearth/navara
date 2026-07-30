import type { ExampleMeta } from "../../sections";

export default {
  section: "basemap",
  order: 1,
  title: { en: "Raster Tiles", ja: "ラスタタイル" },
  description: {
    en: "Display a basemap from TileJSON.",
    ja: "TileJSON からベースマップを表示する。",
  },
  docs: "three/source/raster-tile-source",
} satisfies ExampleMeta;
