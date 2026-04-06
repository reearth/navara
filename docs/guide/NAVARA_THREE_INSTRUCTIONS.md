# Navara Three Documentation Update Guide

Instructions for updating navara_three documentation to match the latest API implementation.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Update Workflow](#update-workflow)
- [Documentation Formats](#documentation-formats)
- [Working with WASM Materials](#working-with-wasm-materials)
- [API](#api)
- [Common Pitfalls](#common-pitfalls)

---

## Quick Reference

### File Locations

| Type | Path |
|------|------|
| **Documentation** | `navara-developer-docs/src/content/docs/navara_three/` |
| **navara_three** | `navara/web/navara_three/src/` |
| **navara_three_api** | `navara/web/navara_three_api/src/` |
| **WASM Types** | `navara/web/wasm/navara_engine/navara_wasm.d.ts` |
| **WASM API Types** | `web/wasm/navara_engine_api/navara_wasm_api.d.ts` |
| **Examples** | `navara/web/navara_three/example/` |

### Implementation to Documentation Mapping

| Implementation | Documentation |
|----------------|---------------|
| `navara_three_api/src/index.ts` | `API/navara_three_api.md` |
| `navara_three/src/index.ts` | `API/threeview-*.md` |
| `navara_three/src/layers/mesh/*.ts` | `Mesh Layer/*.md` |
| `navara_three/src/layers/light/*.ts` | `Light Layer/*.md` |
| `navara_three/src/layers/effect/*.ts` | `Effect Layer/*.md` |
| `navara_three/src/type/index.ts` | `Resource Layer/*-layer.md` |
| `navara_three/src/mesh/*.ts` | `Resource Layer/*-material.md` |

---

## Update Workflow

### Step 1: Identify Changes

Compare implementation against documentation:

**navara_three_api:**
- `src/index.ts` - Exported functions
- `src/ellipsoidGeodesic.ts` - EllipsoidGeodesic class
- `src/intersection.ts` - Intersection utilities
- `src/rte.ts` - RTE utilities

**navara_three:**
- `src/index.ts` - ThreeView class
- `src/layers/mesh/` - Mesh layer types
- `src/layers/light/` - Light layer types
- `src/layers/effect/` - Effect layer types
- `src/type/index.ts` - Type definitions

### Step 2: Update Documentation

1. Read implementation file for exact API
2. Read existing documentation for format
3. Make minimal, targeted edits
4. Maintain existing structure and style

### Step 3: Verify Quality

- [ ] Valid YAML frontmatter with `title`, `description`, `sidebar.order`
- [ ] All code blocks specify language
- [ ] Signatures match implementation exactly
- [ ] Examples are complete and runnable
- [ ] English descriptions, English technical terms
- [ ] No broken links or trailing whitespace

---

## Documentation Formats

### Language Convention

- **Default locale (root):** English
- **Translations:** Locale subdirectories (e.g., `ja/` for Japanese). See [TRANSLATION_GUIDE.md](./TRANSLATION_GUIDE.md)
- **Technical terms:** Always English (`ECEF`, `Vector3`, `LayerHandle`)

### Frontmatter

```yaml
---
title: Page Title
description: Brief description for SEO
sidebar:
  order: 1  # Lower numbers appear first
---
```

### Functions

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
import { functionName } from "@navara/three";

const result = functionName(value);
\`\`\`
```

**Key rules:**
- Parameters section: No type annotations (already in Syntax); **omit entirely if no parameters** (do not write "None")
- Returns section: Omit for `void` functions; no type prefix for others
- Examples: Always include imports; show complete, runnable code

### Properties

```markdown
### propertyName

**Type:** `boolean | undefined`

**Description:** Description of the property

**Default:** `true`

**Example:**

\`\`\`typescript
view.propertyName = newValue;
\`\`\`
```

### Events

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
  // handler code
});
\`\`\`
```

### Layer Types

```markdown
### LayerTypeName

**Type:** Brief type description

**Usage:** Primary use case

**Description:** Detailed explanation

**Key Features:**
- Feature 1
- Feature 2

**Config:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `prop` | `Type` | `default` | Description |

**Usage Example:**

\`\`\`typescript
const layer = view.addLayer<LayerType>({
  type: "mesh",
  config: { property: value },
  position: { x: 0, y: 0, z: 1000 },
});
\`\`\`
```

### Callouts

```markdown
:::note
Important information
:::

:::tip[Recommended]
Recommended approach
:::

:::warning
Caveat or limitation
:::
```

---

## Working with WASM Materials

### Source File

`navara/web/wasm/navara_engine/navara_wasm.d.ts`

### Available Materials

| Material | Purpose |
|----------|---------|
| `BillboardMaterial` | Billboard rendering |
| `ElevationHeatmapMaterial` | Elevation heatmaps |
| `EllipsoidTerrainMaterial` | Ellipsoid terrain |
| `ModelMaterial` | 3D models |
| `PointMaterial` | Point rendering |
| `PolygonMaterial` | Polygon rendering |
| `PolylineMaterial` | Polyline rendering |
| `RasterTerrainMaterial` | Raster terrain |
| `RasterTileMaterial` | Raster tiles |
| `TextMaterial` | Text rendering |
| `VectorTileMaterial` | Vector tiles |

### Extracting Documentation from JSDoc

1. **Focus on getters** - Ignore setters; extract from getter definitions and JSDoc comments

2. **Translate JSDoc to Japanese:**
   ```typescript
   /**
    * Avoid overlapping with the globe surface.
    */
   get offsetDepth(): boolean | undefined;
   ```
   Becomes:
   ```markdown
   **Description:** Avoids overlapping with the globe surface.
   ```

3. **JSDoc patterns to capture:**
   - Default values: `"default: 0.3 when Bloom enabled"`
   - Experimental warnings: `"**Experimental*:"`
   - Dependencies: `"Need to enable \`transparent\`"`

4. **Missing JSDoc** - Infer description from property name and type

---

## API Reference

### navara_three_api Exports

| Category | APIs |
|----------|------|
| Initialization | `initNavaraApi()` |
| Coordinates | `geodeticToVector3()`, `vector3ToGeodetic()` |
| Angles | `degreeToRadian()`, `radianToDegree()` |
| Screen | `convertScreenToWorld()`, `convertWorldToScreen()` |
| Reference Frames | `eastNorthUpToFixedFrame()`, `northEastDownToFixedFrame()`, `northUpEastToFixedFrame()`, `northWestUpToFixedFrame()` |
| WGS84 | `getWGS84SemiMajorAxis()`, `getWGS84SemiMinorAxis()`, `getWGS84EccentricitySquared()`, `getWGS84Flattening()`, `getWGS84Eccentricity()` |
| Intersection | `getPlaneFromPointNormal()`, `getPickRay()`, `getRayPlaneIntersection()`, `getHeightFromEllipsoid()` |
| RTE | `calcModelMatrixRTE()`, `calcCameraPosition()` |
| Geodesic | `EllipsoidGeodesic` class |

### navara_three Layer Types

**Mesh Layers:**
`BoxMeshLayer`, `SphereMeshLayer`, `CylinderMeshLayer`, `TubeMeshLayer`, `PlaneMeshLayer`, `GLTFModelLayer`, `ArclineMeshLayer`, `SmoothLineMeshLayer`, `RainMeshLayer`, `SnowMeshLayer`, `SkyMeshLayer`, `StarsLayer`, `GlowGlobeMeshLayer`, `AxesHelperLayer`, `ArrowHelperLayer`

**Light Layers:**
`SunLightLayer`, `AmbientLightLayer`, `SkyLightProbeLayer`, `LightProbeLayer`

**Effect Layers:**
`SkyEnvMapEffectLayer`, `AerialPerspectiveEffectLayer`, `CloudsEffectLayer`, `RainDropEffectLayer`, `FogLightEffectLayer`, `LensFlareEffectLayer`, `SSAOEffectLayer`, `SSREffectLayer`, `SelectiveBloomEffectLayer`, `SelectiveOutlineEffectLayer`, `DepthOfFieldEffectLayer`, `ColorGradingLUTEffectLayer`, `ToneMappingEffectLayer`, `SMAAEffectLayer`, `FXAAEffectLayer`

### ThreeView API

**Properties** (`threeview-properties.md`):
`camera`, `renderer`, `globe`, `atmosphere`, `toneMappingExposure`, `animation`, `screenSize`, `pixelRatio`, `globeDepthTexture`, `globeNormalTexture`, `normalTexture`

**Methods** (`threeview-functions.md`):
- Lifecycle: `init()`, `dispose()`, `resize()`, `forceUpdate()`
- Layers: `addLayer()`, `updateLayerById()`, `deleteLayerById()`
- Camera: `setCamera()`, `moveCamera()`, `flyTo()`, `lookAt()`, `cameraFollow()`, `rotateAroundAxis()`, `rotateAround()`
- Terrain: `sampleTerrainHeight()`, `observeTerrainHeightAt()`, `pickTerrainPosition()`
- Defaults: `DefaultPlugin.addDefaultPhotorealLayers()` (via `@navara/three_default_plugin`)
- Registration: `registerMesh()`, `registerLight()`, `registerEffect()`

**Events** (`threeview-events.md`):
- Lifecycle: `resize`, `preUpdate`, `postUpdate`, `preRender`, `postRender`
- Interaction: `pick`, `layer`
- Mouse: `mousedown`, `mouseenter`, `mouseleave`, `mousemove`, `mouseup`, `click`

---

## Common Pitfalls

### Do

- Verify types from TypeScript source
- Add new examples alongside existing ones
- Follow existing document organization
- Keep API names and types in English

### Don't

- Guess parameter types
- Remove existing examples
- Change overall structure
- Translate technical terms
- Document private/internal APIs
- Break existing links

### Internal APIs (Do Not Document)

**ThreeView internals:**
`control`, `renderPassOrchestrator`, `selectiveEffectHelper`, `mrtPassLayer`, `transparentPassLayer`, `finalPassLayer`

**Internal effect layers:**
`MRTPassEffectLayer`, `TransparentPassEffectLayer`, `FinalCopyEffectLayer`

**WASM utility types:**
`Vec2`, `Vec3`, `Window` (from @navara/core)

**Base classes:**
`SelectiveEffectLayer`, `TestSelectiveEffectLayer`

---

## Documentation Tree

```
navara_three/
├── Introduction/
│   ├── what-is-navara-three.md
│   ├── what-is-navara-three-api.md
│   ├── about-layer.md
│   └── install.md
├── API/
│   ├── navara_three_api.md
│   ├── threeview-class.md
│   ├── threeview-properties.md
│   ├── threeview-functions.md
│   ├── threeview-events.md
│   └── layer-types.md
├── Resource Layer/
│   ├── resource-layer.md
│   ├── *-layer.md (cesium3dtiles, geojson, mvt, terrain, tile)
│   └── *-material.md (billboard, point, polygon, polyline, etc.)
├── Mesh Layer/
├── Light Layer/
├── Effect Layer/
├── Tutorial/
├── Example/
└── New/
```

---

## Related Documents

- [NAVARA_THREE_UPDATE_CHECKLIST.md](./NAVARA_THREE_UPDATE_CHECKLIST.md) - Scenario-based checklists for specific update types
