import type { ExampleMeta } from "../../sections";

export default {
  section: "getting-started",
  order: 5,
  title: { en: "Camera", ja: "Camera" },
  description: {
    en: "Place the view precisely with setCamera, then glide between airports with flyTo.",
    ja: "setCamera で視点を厳密に置き、flyTo で世界の空港へ滑空する。",
  },
  docs: "three/api/camera",
} satisfies ExampleMeta;
