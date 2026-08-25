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
      title: "Navara Developer Document",
      favicon: "/favicon.png",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/reearth/navara" }],
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
      customCss: ["./src/styles/theme.css", "./src/styles/mermaid.css"],
      components: {
        Sidebar: "./src/components/Sidebar.astro",
        Pagination: "./src/components/Pagination.astro",
        // The docs share the LP's header (LpHeader.astro via Header.astro);
        // light mode is disabled for now, so the theme provider pins dark and
        // the theme picker renders nothing (see each override).
        Header: "./src/components/Header.astro",
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      head: [
        // Fonts for the shared LP header (matches LandingPage.astro's set).
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" },
        },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Arsenal:wght@400;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap",
          },
        },
        // Social thumbnail. Starlight already emits per-page title/description
        // (meta + og:*); og:image is site-wide — the promo poster crop
        // (public/og.jpg, regenerate from public/promo/promo-poster.avif).
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://navara-docs.reearth.workers.dev/og.jpg",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://navara-docs.reearth.workers.dev/og.jpg",
          },
        },
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
