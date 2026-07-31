import type { ExampleMeta } from "../../sections";

export default {
  section: "terrain",
  order: 1,
  title: { en: "Raster Terrain", ja: "ラスタ地形" },
  description: {
    en: "Render elevation tiles as 3D terrain.",
    ja: "標高タイルを 3D 地形として表示する。",
  },
  docs: "three/layer/terrain-layer",
} satisfies ExampleMeta;
