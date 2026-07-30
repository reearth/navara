import type { ExampleMeta } from "../../sections";

export default {
  section: "lighting-effect",
  order: 2,
  title: { en: "Sun & Time of Day", ja: "太陽と時刻" },
  description: {
    en: "Auto-play the sun movement and fly between cities keeping the same sun position.",
    ja: "太陽の動きを自動再生し、太陽の位置を保ったまま各都市へ移動する。",
  },
  docs: "three/api/atmosphere",
} satisfies ExampleMeta;
