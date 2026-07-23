import type { ExampleMeta } from "../../sections";

export default {
  section: "2d",
  order: 1,
  title: { en: "Point", ja: "Point" },
  description: {
    en: "Draw GeoJSON points as fixed-style symbols with color and size.",
    ja: "GeoJSON のポイントを色・サイズ固定の点シンボルで描画する。",
  },
  docs: "three/material/point-material",
} satisfies ExampleMeta;
