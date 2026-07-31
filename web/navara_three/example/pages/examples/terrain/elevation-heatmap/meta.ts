import type { ExampleMeta } from "../../sections";

export default {
  section: "terrain",
  order: 3,
  title: { en: "Elevation Heatmap", ja: "標高ヒートマップ" },
  description: {
    en: "Color-code elevation with a colormap.",
    ja: "標高をカラーマップで色分けする。",
  },
  docs: "three/material/elevation-heatmap-material",
} satisfies ExampleMeta;
