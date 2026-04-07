// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
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
    return {
      label: x,
      autogenerate: {
        directory: x,
        collapsed: false,
      },
    };
  });
}

const sidebar = await autogenSections();

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: "Navara",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/eukarya-inc/navara-developer-docs" }],
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
