import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 5,
  title: { en: "Arc Lines", ja: "アークライン" },
  description: {
    en: "Draw lines between coordinate pairs with ArclineMesh.",
    ja: "ArclineMesh で 2 地点を結ぶ線を描く。",
  },
  docs: "three_default_descs/mesh-desc/arcline-mesh-desc",
} satisfies ExampleMeta;
