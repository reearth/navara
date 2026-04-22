# Writing Rules

Please follow these rules when you modify this repository.

## Terminology

### "Layer" vs "Object" vs "Descriptor"

Mesh, effect, and light APIs were renamed from `*Layer` to `*Desc`. Use the following terms in documentation:

| Context | Term | Example |
|---------|------|---------|
| The rendered thing itself (generic reference) | **object** | "Add a mesh object to the scene" |
| Configuration, class definition, or implementation | **Descriptor** | "Register a Descriptor class", "Can only be set at Descriptor creation time" |
| Resource layers (added via `addLayer()`) | **layer** (unchanged) | "GeoJSON layer", "terrain layer" |

- Do not translate "Descriptor" — use the English term as-is in all locales
- Resource layers retain the term "layer" (or "レイヤー" in Japanese)

## Prefer alias or relative path

- Link to a page: `[Page name](../../../link/to/page)`, not `/link/to/page`.
- Link to a asset: `![Alt](@assets/image.png)`
- Import a component: `import { Button } from "@components/Button"`
