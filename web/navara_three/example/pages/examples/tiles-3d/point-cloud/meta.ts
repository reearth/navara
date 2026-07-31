import type { ExampleMeta } from "../../sections";

export default {
  section: "source",
  order: 4,
  title: { en: "Point Cloud", ja: "点群" },
  description: {
    en: "Render a point-cloud (pnts) 3D Tiles asset.",
    ja: "点群の 3D Tiles を表示する。",
  },
  docs: "three/source/3d-tiles-source",
} satisfies ExampleMeta;
