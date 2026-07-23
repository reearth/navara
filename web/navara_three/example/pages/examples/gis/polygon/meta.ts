import type { ExampleMeta } from "../../sections";

export default {
  section: "2d",
  order: 3,
  title: { en: "Polygon", ja: "Polygon" },
  description: {
    en: "Drape GeoJSON polygons onto the globe surface with clampToGround.",
    ja: "GeoJSON のポリゴンを clampToGround で地球表面に貼り付ける。",
  },
  docs: "three/material/polygon-material",
} satisfies ExampleMeta;
