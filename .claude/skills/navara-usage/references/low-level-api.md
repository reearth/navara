# Low-level API — Feature evaluation, picking, geodetic math

Use these when declarative layer config isn't enough: data-driven styling per feature, spatial queries, or custom geometry placement.

## FeatureEvaluator — data-driven styling

Obtained from layer `featureCreated`/`featureUpdated` events. `evaluate()` runs per batch and returns only the properties you want to override (all optional: `color`, `show`, `height`, `extrudedHeight`, `text`, `width`, `size`, `opacity`, `declutterPriority`):

```typescript
import { Color } from "@navara/three";

const updatedFeatures = new Set<bigint>();
layer.on("featureUpdated", ({ evaluator }) => {
  if (updatedFeatures.has(evaluator.id)) return;   // evaluator.id is a bigint
  updatedFeatures.add(evaluator.id);
  evaluator.evaluate(
    ({ properties }) => ({
      extrudedHeight: (properties?.["height"] as number) ?? 0,
      color: new Color().setStyle((properties?.["color"] as string) ?? "#ffffff"),
      show: ((properties?.["height"] as number) ?? 0) >= 30,
    }),
    { filters: ["height", "color"] },   // read only these attributes — important for perf on large data
  );
});
```

- Prefer `filters` (or `readFilteredFeatureProperties`) over reading all properties on large datasets.
- `readFeatureProperties(cb)` reads attributes without styling (e.g. build a legend).
- **Label decluttering:** set `declutter: true` on a `text`/`point`/`billboard` material to hide screen-overlapping labels (with a fade). Placement priority: layer-level `declutterPriority` on the material, overridable per feature by returning `declutterPriority` from `evaluate()` — higher wins; among equal priorities currently-shown labels are sticky (hysteresis), then ties resolve deterministically by anchor position. Reference: `example/pages/styling/mvt-text`.
- To restyle interactively (click-to-highlight), change your evaluation state and call `layer.forceUpdate()`.
- Full API: https://navara-docs.netlify.app/three/api/feature-evaluator/ — runnable references in the Navara repo: `example/pages/styling/*` (one per geometry × source type).

## Picking & spatial queries

```typescript
view.on("pick", (info) => info?.properties?.["gml:name"]);   // requires picking: true (default)
const ecef = view.pickTerrainPosition(x, y);                  // terrain only
const ecef2 = view.pickDepthPosition(x, y);                   // anything in the depth buffer
const h = view.sampleTerrainHeight({ lat, lng, height: 0 });  // RADIANS in; height required by the type, ignored at runtime
const unobserve = view.observeTerrainHeightAt({ lat, lng }, (height) => { ... });
```

Mouse events (`click`, `mousemove`, …) deliver `MapMouseEvent` with `.clientX/Y` and `.map` (ECEF coords). The `idle` event fires after `idleThreshold` ms without tile/data activity.

## Geodetic / ECEF math (exported from `@navara/three`; standalone in `@navara/three_api`)

Positions in the scene are **ECEF meters**. Geodetic helpers take **radians**.

```typescript
import {
  geodeticToVector3, vector3ToGeodetic, degreeToRadian,
  eastNorthUpToFixedFrame, geodeticSurfaceNormal,
  getPickRay, getPlaneFromPointNormal, getRayPlaneIntersection,
  convertWorldToScreen, EllipsoidGeodesic,
} from "@navara/three";

// position is Cartesian ECEF by default — a bare position won't stand upright at a
// lng/lat. Build a tangent frame at the origin and pass it as matrixWorld; then
// position/rotation/scale are offsets WITHIN that frame, in meters:
const origin = geodeticToVector3({
  lat: degreeToRadian(35.681236),
  lng: degreeToRadian(139.767125),
  height: 0,
});
const enuFrame = eastNorthUpToFixedFrame(origin);
view.addMesh<BoxMeshDesc>({
  box: { width: 50, height: 100, depth: 50 },
  matrixWorld: enuFrame,
  position: { x: 200, y: 50, z: 0 },   // offsets WITHIN the ENU frame, in meters
});

// Geodesic distance / interpolation on the ellipsoid:
const geodesic = new EllipsoidGeodesic(startLLE, endLLE);
geodesic.distance; geodesic.interpolatePoints(64);
```

Pick the tangent-frame function by the axis orientation your mesh expects — all take an ECEF origin `Vector3` and return a `Matrix4`, all exported from `@navara/three`:

| Function | Local axes (x, y, z) |
|---|---|
| `eastNorthUpToFixedFrame` | East, North, Up |
| `northEastDownToFixedFrame` | North, East, Down |
| `northUpEastToFixedFrame` | North, Up, East |
| `northWestUpToFixedFrame` | North, West, Up |

Mesh transform modes: standard `position`/`rotation`/`scale` (Cartesian ECEF — the default), `matrix` (local frame), `matrixWorld` (world frame — the usual choice for geographic placement, as above).

Full math API reference: https://navara-docs.netlify.app/three/api/navara_three_api — the most complete runnable reference for picking + geometry math is `example/pages/debug/mesh-picking/main.ts` in the Navara repo.
