import { readFileSync } from "fs";
import { resolve } from "path";

import invariant from "tiny-invariant";
import type { Plugin } from "vite";

export type PageConfig = {
  name: string;
  filename: string;
  entry: string;
  data: { title: string };
};

type Options = {
  templatePath: string;
  pages: PageConfig[];
};

function renderHtml(
  template: string,
  entry: string,
  data: { title: string },
): string {
  const html = template.replace(/<%= title %>/g, data.title);
  return html.replace(
    "</body>",
    `    <script type="module" src="${entry}"></script>\n  </body>`,
  );
}

export function createMpaPlugin({ templatePath, pages }: Options): Plugin {
  const template = readFileSync(templatePath, "utf-8");
  const pageMap = new Map<string, PageConfig>();
  for (const page of pages) {
    pageMap.set(page.filename, page);
  }

  // Resolved absolute paths are computed after configResolved provides the root.
  let root = "";
  const resolvedPaths = new Map<string, string>();

  function resolvedPath(filename: string): string {
    return resolve(root, filename);
  }

  return {
    name: "example-mpa",

    configResolved(config) {
      root = config.root;
      for (const page of pages) {
        resolvedPaths.set(resolvedPath(page.filename), page.filename);
      }
    },

    config(_config, { command }) {
      if (command === "build") {
        const input: Record<string, string> = {};
        for (const page of pages) {
          input[page.name] = page.filename;
        }
        return {
          build: {
            rollupOptions: {
              input,
            },
          },
        };
      }
    },

    resolveId(id) {
      // Handle absolute paths
      if (resolvedPaths.has(id)) {
        return id;
      }
      // Handle relative paths (e.g., "globe.html" or "/globe.html")
      const normalized = id.startsWith("/") ? id.slice(1) : id;
      if (pageMap.has(normalized)) {
        return resolvedPath(normalized);
      }
    },

    load(id) {
      const filename = resolvedPaths.get(id);
      if (!filename) return;
      const page = pageMap.get(filename);
      if (!page) return;
      return renderHtml(template, page.entry, page.data);
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/" || req.url === "") {
          req.url = "/index.html";
        }

        const urlPath = (req.url ?? "").split("?")[0];
        let filename = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

        // Allow accessing pages without .html extension (e.g., /globe -> /globe.html)
        if (!filename.endsWith(".html") && pageMap.has(filename + ".html")) {
          filename = filename + ".html";
        }

        if (pageMap.has(filename)) {
          const page = pageMap.get(filename);
          invariant(page);
          const html = renderHtml(template, page.entry, page.data);
          server
            .transformIndexHtml(urlPath, html)
            .then((transformed) => {
              res.setHeader("Content-Type", "text/html");
              res.statusCode = 200;
              res.end(transformed);
            })
            .catch(next);
          return;
        }

        next();
      });
    },
  };
}
