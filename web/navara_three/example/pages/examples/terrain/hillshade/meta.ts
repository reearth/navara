import type { ExampleMeta } from "../../sections";

export default {
  section: "terrain",
  order: 2,
  title: { en: "Hillshade", ja: "ヒルシェード" },
  description: {
    en: "Drape shaded relief computed from elevation tiles.",
    ja: "標高タイルから計算した陰影起伏を表示する。",
  },
  docs: "three/material/hillshade-material",
} satisfies ExampleMeta;
