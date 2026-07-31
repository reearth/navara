import type { ExampleMeta } from "../../sections";

export default {
  section: "terrain",
  order: 5,
  title: { en: "TileJSON", ja: "TileJSON" },
  description: {
    en: "Render elevation tiles as 3D terrain from TileJSON.",
    ja: "TileJSONから標高タイルを 3D 地形として表示する。",
  },
  docs: "three/layer/terrain-layer",
} satisfies ExampleMeta;
