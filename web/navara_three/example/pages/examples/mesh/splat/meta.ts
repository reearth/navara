import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 8,
  title: { en: "Gaussian Splat", ja: "ガウシアンスプラット" },
  description: {
    en: "Place a 3D Gaussian Splat asset on the globe with SplatMesh.",
    ja: "SplatMesh で 3D ガウシアンスプラットのアセットを地球上に配置する。",
  },
  docs: "three_default_descs/mesh-desc/splat-mesh-desc",
} satisfies ExampleMeta;
