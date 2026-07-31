import type { ExampleMeta } from "../../sections";

export default {
  section: "lighting-effect",
  order: 1,
  title: { en: "Atmosphere", ja: "大気" },
  description: {
    en: "Render physically-based atmospheric scattering.",
    ja: "物理ベースの大気散乱を表示する",
  },
  docs: "three/tutorial/realistic-atmosphere",
} satisfies ExampleMeta;
