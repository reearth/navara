import type { ExampleMeta } from "../../sections";

export default {
  section: "3d",
  order: 3,
  title: { en: "glTF Animation", ja: "glTF アニメーション" },
  description: {
    en: "Play and crossfade a glTF model's animation clips with addMesh.",
    ja: "addMesh で glTF モデルのアニメーションクリップを再生・切替する。",
  },
  docs: "three_default_descs/mesh-desc/gltf-model-desc",
} satisfies ExampleMeta;
