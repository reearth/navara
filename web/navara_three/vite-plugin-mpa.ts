import { readFileSync } from "fs";
import { resolve } from "path";

import invariant from "tiny-invariant";
import { normalizePath, type Plugin } from "vite";

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
  let template = readFileSync(templatePath, "utf-8");
  const pageMap = new Map<string, PageConfig>();
  for (const page of pages) {
    pageMap.set(page.filename, page);
  }

  // Resolved absolute paths are computed after configResolved provides the root.
  let root = "";
  const resolvedPaths = new Map<string, string>();

  function resolvedPath(filename: string): string {
    return normalizePath(resolve(root, filename));
  }

  return {
    name: "mpa",

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
      const normalizedId = normalizePath(id);
      // Handle absolute paths
      if (resolvedPaths.has(normalizedId)) {
        return normalizedId;
      }
      // Handle relative paths (e.g., "globe.html" or "/globe.html")
      const stripped = normalizedId.startsWith("/")
        ? normalizedId.slice(1)
        : normalizedId;
      if (pageMap.has(stripped)) {
        return resolvedPath(stripped);
      }
    },

    load(id) {
      const filename = resolvedPaths.get(normalizePath(id));
      if (!filename) return;
      const page = pageMap.get(filename);
      if (!page) return;
      return renderHtml(template, page.entry, page.data);
    },

    configureServer(server) {
      server.watcher.add(templatePath);
      server.watcher.on("change", (file) => {
        if (normalizePath(file) === normalizePath(templatePath)) {
          template = readFileSync(templatePath, "utf-8");
          server.ws.send({ type: "full-reload" });
        }
      });

      server.middlewares.use((req, res, next) => {
        const [urlPath, query] = (req.url ?? "").split("?", 2);
        let filename = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;

        // Rewrite root to index.html
        if (filename === "") {
          filename = "index.html";
          req.url = "/index.html" + (query ? `?${query}` : "");
        }

        // Allow accessing pages without .html extension (e.g., /globe -> /globe.html)
        if (!filename.endsWith(".html") && pageMap.has(filename + ".html")) {
          filename = filename + ".html";
        }

        if (pageMap.has(filename)) {
          const page = pageMap.get(filename);
          invariant(page);
          const html = renderHtml(template, page.entry, page.data);
          server
            .transformIndexHtml("/" + filename, html)
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
