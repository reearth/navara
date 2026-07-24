import type { ExampleMeta } from "../../sections";

export default {
  section: "lighting-effect",
  order: 20,
  title: { en: "Clouds", ja: "雲" },
  description: {
    en: "Volumetric clouds drift over Mt. Fuji; cycle the coverage from a few puffs to overcast.",
    ja: "富士山の上を漂うボリュメトリック雲。被覆率を切り替えて量を変える。",
  },
  docs: "three_default_descs/effect-desc/clouds-effect-desc",
} satisfies ExampleMeta;
