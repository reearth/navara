// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import rehypeMermaid from "rehype-mermaid";
import { readdir } from "fs/promises";

// Locale directory names to exclude from sidebar generation.
// These are handled by Starlight's built-in locale routing.
const localeDirectories = new Set(["ja"]);

/**
 * Automatically generate sidebar sections based on directory structure
 */
async function autogenSections() {
  const sections = (
    await readdir("./src/content/docs/", {
      withFileTypes: true,
    })
  )
    .filter((x) => x.isDirectory() && !localeDirectories.has(x.name))
    .map((x) => x.name);
  return sections.map((x) => {
    // Starlight v0.39 removed `label` + `autogenerate` shorthand; autogenerate
    // config now goes inside an `items` array.
    return {
      label: x,
      items: [
        {
          autogenerate: {
            directory: x,
            collapsed: false,
          },
        },
      ],
    };
  });
}

const sidebar = await autogenSections();

// https://astro.build/config
export default defineConfig({
  // Until release the docs top pages live at / and /<locale>/ while the
  // landing page is parked at /lp and /<locale>/lp. At release, swap back:
  // git mv src/pages/lp.astro src/pages/index.astro (and the ja variant),
  // git mv src/content/docs/index.mdx src/content/docs/home.mdx (and ja),
  // then point lp.json's docs/roadmap links at /home/ and restore lpPathOf
  // in LandingPage.astro to locale roots.
  markdown: {
    rehypePlugins: [[rehypeMermaid, { strategy: "inline-svg" }]],
  },
  integrations: [
    starlight({
      title: "Navara",
      favicon: "/favicon.png",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/eukarya-inc/navara" }],
      defaultLocale: "root",
      locales: {
        root: {
          lang: "en",
          label: "English",
        },
        ja: {
          label: "日本語",
        },
      },
      customCss: ["./src/styles/mermaid.css"],
      components: {
        Sidebar: "./src/components/Sidebar.astro",
        Pagination: "./src/components/Pagination.astro",
        Header: "./src/components/Header.astro",
      },
      head: [
        // TODO: Remove when Navara is released.
        {
          tag: "meta",
          attrs: {
            name: "robots",
            content: "noindex,nofollow",
          },
        },
      ],
      sidebar: sidebar,
    }),
  ],
});
