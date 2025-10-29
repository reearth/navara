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

## Shadcn/UI Components (example/components)

The example app ships with a small, local set of [shadcn/ui]-style React components under `example/components/ui`. These provide a lightweight, styled UI for the example pages and are not part of the published library.

Two ways to manage components:

- Option A — CLI: Run `npx shadcn@latest add …` inside `web/navara_three`.
- Option B — MCP: Configure `.mcp.json` (see below) to register the `shadcn` MCP server, then trigger the same `add` actions through your MCP client.

- Included: `button.tsx`, `card.tsx` (with `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`), `input.tsx`, `label.tsx`, `separator.tsx`.
- Aliases: Import via `@/components/ui/*` and utilities via `@/lib/utils` (see `tsconfig.json`).
- Tailwind: Tokens and dark mode are defined per page in `example/pages/<name>/globals.css` and imported from each page's `main.ts`. Tailwind is configured in `tailwind.config.ts` with `content: ["./example/**/*"]` and CSS variables enabled.

### Using the components

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Type here" />
        <div className="flex items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost" size="icon" aria-label="Icon">
            •
          </Button>
        </div>
        <Separator />
      </CardContent>
    </Card>
  );
}
```

### Add or update components (CLI)

The repository contains a shadcn CLI configuration at `web/navara_three/components.json` that targets this example app. To add more components or refresh existing ones:

1. Change directory to the package that holds `components.json`:
   - `cd web/navara_three`
2. Use the shadcn CLI to add components (writes into `example/components/ui` via the alias):
   - Add specific components: `npx shadcn@latest add button card input label separator`
   - Add another component later: `npx shadcn@latest add textarea`
3. Re-run the dev server if needed: `pnpm --filter @navara/three dev` or `pnpm --filter @navara/three build:example`.

Notes:

- The CLI reads paths/aliases from `components.json` and `tsconfig.json` (already set up for this example).
- New components may require extra Radix packages; install prompts will be handled by the CLI.

### Add or update components (MCP)

If you prefer MCP, add the shadcn MCP server config manually following [shadcn document](https://www.shadcn.io/mcp).

### Theming and tokens

- Color tokens and radii live in each page's `globals.css` (e.g. `example/pages/index/globals.css`) as CSS variables and power Tailwind theme values defined in `tailwind.config.ts`.
- Dark mode is toggled by the `dark` class on `<html>`; see `pages/index/App.tsx` for a usage example.

### What these components are (and aren’t)

- They are example‑only UI primitives used to build the example pages quickly.
- They are not exported by `@navara/three` and won’t ship in the library build.

[shadcn/ui]: https://ui.shadcn.com
