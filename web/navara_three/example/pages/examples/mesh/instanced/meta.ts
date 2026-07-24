import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 4,
  title: { en: "Instanced Meshes", ja: "インスタンス描画" },
  description: {
    en: "Draw one glTF model thousands of times in a single draw call.",
    ja: "1 つの glTF モデルを 1 draw call で数千個描画する GPU インスタンシング。",
  },
  docs: "three_default_descs/mesh-desc/instanced-gltf-model-mesh-desc",
} satisfies ExampleMeta;
