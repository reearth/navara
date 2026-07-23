import type { ExampleMeta } from "../../sections";

export default {
  section: "2d",
  order: 2,
  title: { en: "Polyline", ja: "Polyline" },
  description: {
    en: "Draw GeoJSON lines with a fixed color and width.",
    ja: "GeoJSON のラインを色・太さ固定のポリラインで描画する。",
  },
  docs: "three/material/polyline-material",
} satisfies ExampleMeta;
