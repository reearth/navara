import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 6,
  title: { en: "Smooth Lines", ja: "スムースライン" },
  description: {
    en: "Draw a smooth interpolated line through a set of points with SmoothLineMesh.",
    ja: "SmoothLineMesh で点列から補完された滑らかな線を描く。",
  },
  docs: "three_default_descs/mesh-desc/smooth-line-mesh-desc",
} satisfies ExampleMeta;
