# Navara Three — Examples

This folder contains the WebGL examples for `@navara/three`. Each subfolder in `pages/` is an example that is built as its own page by Vite's multi‑page setup. The index page lists all examples grouped by category and shows a thumbnail for each one.

## Directory Structure

Examples are organized into categories using nested directories:

```
pages/
├── index/                    # Index page (special)
├── basic/                    # Basic layer demonstrations
│   ├── geojson-polygon/
│   ├── mvt-point/
│   └── ...
├── styling/                  # Feature styling with evaluators
│   ├── geojson-polygon/
│   ├── mvt-polygon/
│   ├── cesium3dtiles/
│   └── ...
├── atmosphere/               # Atmosphere and lighting
├── camera/                   # Camera controls
└── globe/                    # Single-level examples (uncategorized)
```

- **Categorized examples**: `pages/<category>/<example>/main.ts` → URL: `/<category>-<example>`
- **Uncategorized examples**: `pages/<example>/main.ts` → URL: `/<example>`

## Adding a New Example

### Step 1: Choose a Category

Decide if your example fits into an existing category or should be uncategorized:

| Category      | Purpose                                                              |
| ------------- | -------------------------------------------------------------------- |
| `basic/`      | Basic layer type demonstrations (geojson, mvt, tiles, terrain, etc.) |
| `styling/`    | Feature styling with evaluators                                      |
| `atmosphere/` | Sky, lighting, and atmospheric effects                               |
| `camera/`     | Camera controls, constraints, animations                             |
| `effects/`    | Post-processing and visual effects                                   |
| (root)        | Uncategorized / standalone examples                                  |

### Step 2: Create the Example Directory

```bash
# For categorized example:
mkdir -p web/navara_three/example/pages/<category>/<example-name>

# For uncategorized example:
mkdir -p web/navara_three/example/pages/<example-name>
```

### Step 3: Create `main.ts`

Create a `main.ts` file in your example directory. Here's a minimal template:

```typescript
import ThreeView, { Color } from "@navara/three";
import { Pane } from "tweakpane";

const run = async () => {
  // Initialize the view
  const view = new ThreeView({ debug: true });
  await view.init();

  // Add default atmosphere (sky, sun, etc.)
  view.addDefaultAtmosphereLayers();

  // Set initial camera position
  view.setCamera({
    lng: 139.75,
    lat: 35.68,
    height: 1000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Add your layers here
  const layer = view.addLayer({
    type: "geojson",
    data: {
      /* your data */
    },
    polygon: {
      color: new Color().setStyle("#00aaff"),
      // ... other properties
    },
  });

  // Add control panel (optional)
  const pane = new Pane({ title: "Example Controls" });

  const params = { opacity: 1.0 };
  pane
    .addBinding(params, "opacity", { min: 0, max: 1 })
    .on("change", ({ value }) => {
      layer.update({ polygon: { opacity: value } });
    });
};

run();
```

### Step 4: Start the Dev Server

```bash
cargo make dev
# or
pnpm --filter @navara/three dev
```

Your example is now available at:

- Categorized: `http://localhost:5173/<category>-<example-name>`
- Uncategorized: `http://localhost:5173/<example-name>`

### Step 5: Generate Screenshot (Optional)

```bash
pnpm navara_three screenshots <category>-<example-name>
```

## Philosophy: Keep Examples Simple

> "Don't hide our API inside abstractions in the example"

Examples should demonstrate how to use the API directly. Users reading examples should see exactly what API calls are needed, not wrapper functions that obscure the actual usage.

**Do:**

- Use `view.addLayer()` directly
- Use `layer.on("featureUpdated", ...)` for feature styling
- Use `layer.update()` or `layer.forceUpdate()` for updates
- Use Tweakpane bindings with explicit change handlers

**Don't:**

- Create wrapper functions that hide API calls
- Use complex abstractions that obscure the actual usage
- Combine multiple unrelated features in one example

## Example: Control Panel Pattern

Use Tweakpane for interactive controls. For simple cases, use direct bindings:

```typescript
import { Pane } from "tweakpane";

const pane = new Pane({ title: "Layer Controls" });

// Simple binding
const params = { visible: true, opacity: 1.0 };

pane.addBinding(params, "visible").on("change", ({ value }) => {
  layer.update({ polygon: { show: value } });
});

pane
  .addBinding(params, "opacity", { min: 0, max: 1, step: 0.01 })
  .on("change", ({ value }) => {
    layer.update({ polygon: { opacity: value } });
  });

// Button for actions
pane.addButton({ title: "Reset" }).on("click", () => {
  // Reset logic
});
```

For complex fields with many parameters, use `addFieldsToFolder`:

```typescript
import { Pane } from "tweakpane";
import { addFieldsToFolder } from "../../helpers/panel";

const pane = new Pane({ title: "Layer Controls" });
const folder = pane.addFolder({ title: "Polygon Settings" });

const params = {
  opacity: 1.0,
  extrudedHeight: 100,
  wireframe: false,
  metalness: 0.5,
  roughness: 0.5,
};

addFieldsToFolder(folder, params, [
  {
    name: "opacity",
    params: { min: 0, max: 1, step: 0.01 },
    onChange: ({ value }) => {
      layer.update({ polygon: { opacity: value } });
    },
  },
  {
    name: "extrudedHeight",
    params: { min: 0, max: 500, step: 10 },
    onChange: ({ value }) => {
      layer.update({ polygon: { extrudedHeight: value } });
    },
  },
  {
    name: "wireframe",
    onChange: ({ value }) => {
      layer.update({ polygon: { wireframe: value } });
    },
  },
  {
    name: "metalness",
    params: { min: 0, max: 1, step: 0.01 },
    onChange: ({ value }) => {
      layer.update({ polygon: { metalness: value } });
    },
  },
  {
    name: "roughness",
    params: { min: 0, max: 1, step: 0.01 },
    onChange: ({ value }) => {
      layer.update({ polygon: { roughness: value } });
    },
  },
]);
```

## Updating screenshots

The index page shows a card grid using screenshots from `example/public/screenshots/<page>.png`. After adding or changing an example, generate or refresh its thumbnail:

1. Keep the dev server running (in another terminal): `cargo make dev`.
2. From root, run one of:
   - All pages: `pnpm navara_three screenshots`
   - Specific page(s): `pnpm navara_three screenshots <page> [another-page]`
3. You can specify waiting time to `PAGE_CONFIGS` in `web/navara_three/scripts/generate-screenshots.ts`.

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
