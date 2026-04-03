# Documentation Update Checklist

Scenario-based checklists for specific documentation updates. For comprehensive instructions, see [NAVARA_THREE_INSTRUCTIONS.md](./NAVARA_THREE_INSTRUCTIONS.md).

## Table of Contents

- [Adding New APIs](#adding-new-apis)
- [Adding New Layers](#adding-new-layers)
- [Modifying Existing APIs](#modifying-existing-apis)
- [Validation](#validation)
- [Code Patterns](#code-patterns)

---

## Adding New APIs

### New Function (navara_three_api)

**Files:** `navara_three_api/src/*.ts` → `API/navara_three_api.md`

- [ ] Read implementation for exact signature
- [ ] Identify section (Ellipsoid, Coordinate, etc.)
- [ ] Add documentation in logical order
- [ ] Verify types match exactly
- [ ] Check examples in `navara_three/example`

### New ThreeView Method

**Files:** `navara_three/src/index.ts` → `API/threeview-functions.md`

- [ ] Read implementation for exact signature
- [ ] Identify category (Lifecycle, Layers, Camera, Terrain, etc.)
- [ ] Add to appropriate section
- [ ] Update method summary tables if present
- [ ] Check examples in `navara_three/example`

### New ThreeView Property

**Files:** `navara_three/src/index.ts` → `API/threeview-properties.md`

- [ ] Read property definition for type and default
- [ ] Add documentation with Type, Description, Default, Example
- [ ] Note if read-only

### New ThreeView Event

**Files:** `navara_three/src/index.ts` (ViewEvents) → `API/threeview-events.md`

- [ ] Read event handler type from ViewEvents
- [ ] Add documentation with Handler Type, Description, Example

---

## Adding New Layers

### New Mesh Layer

**Files:** `navara_three/src/layers/mesh/[New].ts` → `Mesh Layer/`

- [ ] Read implementation for config type
- [ ] Update `meshlayer.md` index table
- [ ] Create new file with frontmatter
- [ ] Document all config properties
- [ ] Add basic and advanced examples
- [ ] Check `navara_three/example` for references

### New Light Layer

**Files:** `navara_three/src/layers/light/[New].ts` → `Light Layer/`

- [ ] Read implementation for config type
- [ ] Update `lightlayer.md` index table
- [ ] Create new file with proper format
- [ ] Document all config properties
- [ ] Add usage examples with imports

### New Effect Layer

**Files:** `navara_three/src/layers/effect/[New].ts` → `Effect Layer/`

- [ ] Read implementation for config and render pass details
- [ ] Update `effectlayer.md` index table
- [ ] Create new file
- [ ] Explain visual effect in English
- [ ] Add before/after examples if applicable

### New Resource Layer Type

**Files:** `navara_three/src/type/index.ts` → `Resource Layer/`

- [ ] Read type definition
- [ ] Update `resource-layer.md` index
- [ ] Create new `*-layer.md` file with all properties
- [ ] Document nested types
- [ ] Add complete usage examples

### New Material Type

**Files:** `navara_three/src/mesh/*.ts` or WASM types → `Resource Layer/`

- [ ] Read material implementation/type
- [ ] Update `resource-layer.md` material index
- [ ] Create new `*-material.md` file with properties
- [ ] Document styling options
- [ ] Add visual examples if possible

---

## Modifying Existing APIs

### Property Changed (Type or Default)

- [ ] Read updated implementation
- [ ] Update **Type:** if changed
- [ ] Update **Default:** if changed
- [ ] Update examples using old type/default
- [ ] Check related documentation for consistency

### Signature Changed

- [ ] Read new signature from implementation
- [ ] Update code block with new signature
- [ ] Update **Parameters:** section
- [ ] Update **Returns:** section
- [ ] Update all examples
- [ ] Check `navara_three/example` for usages

### API Removed

- [ ] Verify actually removed (not renamed)
- [ ] Remove documentation section
- [ ] Remove from index tables
- [ ] Check references in other docs
- [ ] Add deprecation notice in `New/` if applicable
- [ ] Update `navara_three/example`

---

## Validation

Run after any update:

- [ ] Valid YAML frontmatter
- [ ] No broken markdown formatting
- [ ] All code blocks have language specified
- [ ] Types match implementation exactly
- [ ] Examples are complete and runnable
- [ ] English text is grammatically correct
- [ ] Internal links work
- [ ] Sidebar order numbers don't conflict
- [ ] Examples in `navara_three/example` are consistent

---

## Code Patterns

### Imports

```typescript
// navara_three
import ThreeView from "@navara/three";
import ThreeView, { LayerType } from "@navara/three";

// navara_three_api
import { initNavaraApi, functionName } from "@navara/three_api";
```

### Layer Addition

```typescript
const layer = view.addLayer<LayerType>({
  type: "mesh" | "light" | "effect" | "tiles" | "terrain" | "geojson" | "cesium3dtiles" | "mvt",
  [config]: { /* ... */ },
  position: { x: 0, y: 0, z: 0 },
});
```

### Event Handling

```typescript
// Subscribe
const unsubscribe = view.on("eventName", (param) => {
  // handler
});

// Unsubscribe
unsubscribe();
```

### Initialization

```typescript
const view = new ThreeView({ container: element });
await view.init();
```

---

## Documentation Templates

### Function

```markdown
### functionName()

Description of the function.

**Syntax:**

\`\`\`typescript
functionName(param: Type): ReturnType
\`\`\`

**Parameters:**

- `param`: Description of the parameter

**Returns:**

Description of the return value

**Example:**

\`\`\`typescript
const result = functionName(value);
\`\`\`
```

### Property

```markdown
### propertyName

**Type:** `TypeName`

**Description:** Description of the property

**Default:** `defaultValue`

**Example:**

\`\`\`typescript
view.propertyName = newValue;
\`\`\`
```

### Event

```markdown
### eventName

**Description:** Description of the event

**Handler Type:**

\`\`\`typescript
(param: ParamType) => void
\`\`\`

**Parameters:**

- `param`: Description of the parameter

**Example:**

\`\`\`typescript
view.on("eventName", (param) => {
  // handler
});
\`\`\`
```

### Layer Type (Index Entry)

```markdown
| [LayerName](./layer-name) | `ConfigType` | Description of usage |
```

### New File Frontmatter

```yaml
---
title: PageTitle
description: Brief description
sidebar:
  order: [number]
---
```
