import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 7,
  title: { en: "Glow Globe", ja: "グローグローブ" },
  description: {
    en: "Wrap the planet in a fresnel atmosphere halo with GlowGlobeMesh.",
    ja: "GlowGlobeMesh で地球のリムに沿ったフレネルの大気グローを描く。",
  },
  docs: "three_default_descs/mesh-desc/glow-globe-mesh-desc",
} satisfies ExampleMeta;
