import type { ExampleMeta } from "../../sections";

export default {
  section: "getting-started",
  order: 4,
  title: { en: "Sources", ja: "Sources" },
  description: {
    en: "One source, one layer: swap the source's data and the layer reloads.",
    ja: "Source と Layer の分離を掴む。ソースを差し替えると表示が更新される。",
  },
  docs: "three/source/about",
} satisfies ExampleMeta;
