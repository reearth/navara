import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 2,
  title: { en: "glTF Model", ja: "glTF Model" },
  description: {
    en: "Pin a glTF model to a map coordinate with addMesh.",
    ja: "glTF モデルを addMesh で地図上の座標にピン留めする。",
  },
  docs: "three_default_descs/mesh-desc/gltf-model-desc",
} satisfies ExampleMeta;
