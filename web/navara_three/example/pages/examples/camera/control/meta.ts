import type { ExampleMeta } from "../../sections";

export default {
  section: "getting-started",
  order: 5,
  title: { en: "Camera", ja: "Camera" },
  description: {
    en: "Set the initial view with setCamera, then move the camera with an animated flyTo.",
    ja: "setCamera で初期位置を設定し、flyTo でアニメーション付きでカメラ移動する。",
  },
  docs: "three/api/camera",
} satisfies ExampleMeta;
