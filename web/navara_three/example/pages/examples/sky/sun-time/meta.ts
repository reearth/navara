import type { ExampleMeta } from "../../sections";

export default {
  section: "lighting-effect",
  order: 2,
  title: { en: "Sun & Time of Day", ja: "太陽と時刻" },
  description: {
    en: "Auto-play the sun through a day; hop between cities keeping the same local solar time.",
    ja: "太陽の1日を自動再生し、地方太陽時を保ったまま各都市へ移動する。",
  },
  docs: "three/api/atmosphere",
} satisfies ExampleMeta;
