import type { ExampleMeta } from "../../sections";

export default {
  section: "basemap",
  order: 3,
  title: { en: "Raster Overlay", ja: "ラスタオーバーレイ" },
  description: {
    en: "Display multiple basemaps stacked on top of each other.",
    ja: "複数のベースマップを重ねて表示する。",
  },
  docs: "three/material/raster-material",
} satisfies ExampleMeta;
