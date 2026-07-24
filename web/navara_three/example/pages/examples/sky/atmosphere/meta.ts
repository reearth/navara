import type { ExampleMeta } from "../../sections";

export default {
  section: "lighting-effect",
  order: 1,
  title: { en: "Atmosphere", ja: "大気" },
  description: {
    en: "Physically-based atmospheric scattering paints the sky from horizon blue to the black of space.",
    ja: "物理ベースの大気散乱が、地平の青から宇宙の黒へと空を描く。",
  },
  docs: "three/tutorial/realistic-atmosphere",
} satisfies ExampleMeta;
