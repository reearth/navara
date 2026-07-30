import type { ExampleMeta } from "../../sections";

export default {
  section: "basemap",
  order: 2,
  title: { en: "Vector Map", ja: "ベクタマップ" },
  description: {
    en: "Display a vector tile basemap.",
    ja: "ベクタータイルベースマップを表示する。",
  },
  docs: "three/source/vector-tile-source",
} satisfies ExampleMeta;
