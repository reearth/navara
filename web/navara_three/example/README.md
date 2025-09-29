# Navara Three — Examples

This folder contains the WebGL examples for `@navara/three`. Each subfolder in `pages/` is an example that is built as its own page by Vite’s multi‑page setup. The index page lists all examples and shows a thumbnail for each one.

## Adding a New Example

1. Create a new folder under `web/navara_three/example/pages/<your-example>/`.
2. Add an entry file `main.ts` that mounts your example into the `#main` element (see any existing example for a template).
3. Start/refresh the dev server — the new page is available at `/<your-example>`.

## Updating screenshots

The index page shows a card grid using screenshots from `example/public/screenshots/<page>.png`. After adding or changing an example, generate or refresh its thumbnail:

1. Keep the dev server running (in another terminal): `cargo make dev`.
2. From root, run one of:
   - All pages: `pnpm navara_three screenshots`
   - Specific page(s): `pnpm navara_three screenshots <page> [another-page]`

Notes:

- The screenshot tool expects the dev server at `http://localhost:5173` by default. If yours runs elsewhere, override it:
  - `SERVER_URL=http://localhost:5174 pnpm run screenshots`
- On first use, you may need Playwright browsers installed:
  - `pnpm exec playwright install`
- Output files are saved to `web/navara_three/example/public/screenshots/` and are picked up by the index automatically.

## Structure & Conventions

- Examples live under `example/pages/<name>/` and become available at `/<name>`.
- The shared HTML template is `example/template.html` (contains a `div#main`).
- Static assets for examples are served from `example/public/` (available at `/`).
