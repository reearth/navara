---
title: ThreeView Functions
description: API Reference for ThreeView Class Functions
sidebar:
  order: 13
---

This page describes all functions (methods) available on a ThreeView instance.

## Methods

### addLayer()

Adds a new resource layer to navara_three. This method is used for resource layers only (tiles, terrain, geojson, mvt, cesium3dtiles, b3dm, pnts). For mesh, light, and effect descriptors, use `addMesh()`, `addLight()`, and `addEffect()` respectively.

**Syntax:**

```tsx
addLayer(l: LayerDescription): Layer
```

**Parameters:**

For detailed types of LayerDescription, see [Resource Layer Reference](../../../three/resource-layer-reference/resource-layer/).

**Returns:**

```tsx
Layer;
```

Returns a `Layer` instance for the added resource layer.

**Example:**

```tsx
const layer = view.addLayer({
  type: "tiles",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: {
    segments: 10,
    color: new Color().setStyle("#cccccc"),
    maxSse: 2,
    maxZoom: 23,
    wireframe: false,
  },
});
```

### addMesh()

Adds a new mesh descriptor to navara_three. The mesh descriptor class must be registered with `registerMesh()` before calling this method.

**Syntax:**

```tsx
addMesh<L = unknown>(l: MeshDescription): MeshHandle<L>
```

**Returns:**

```tsx
MeshHandle<L>;
```

Returns a `MeshHandle<L>` for controlling the mesh descriptor.

**Example:**

```tsx
// SkyMeshDesc must be registered
const skyHandle = view.addMesh<SkyMeshDesc>({ sky: {} });
```

### addLight()

Adds a new light descriptor to navara_three. The light descriptor class must be registered with `registerLight()` before calling this method.

**Syntax:**

```tsx
addLight<L = unknown>(l: LightDescription): LightHandle<L>
```

**Returns:**

```tsx
LightHandle<L>;
```

Returns a `LightHandle<L>` for controlling the light descriptor.

**Example:**

```tsx
// SunLightDesc must be registered
const sunHandle = view.addLight<SunLightDesc>({ sun: { intensity: 1.0 } });
```

### addEffect()

Adds a new effect descriptor to navara_three. The effect descriptor class must be registered with `registerEffect()` before calling this method.

**Syntax:**

```tsx
addEffect<L = unknown>(l: EffectDescription): EffectHandle<L>
```

**Returns:**

```tsx
EffectHandle<L>;
```

Returns a `EffectHandle<L>` for controlling the effect descriptor.

**Example:**

```tsx
// FXAAEffectDesc must be registered
const fxaaHandle = view.addEffect<FXAAEffectDesc>({ fxaa: {} });
```

### updateLayerById()

Updates an existing resource layer's configuration by its ID.
Only works for resource layers added via `addLayer()`.

**Syntax:**

```tsx
updateLayerById(id: string, l: LayerDescription): void
```

**Parameters:**

- `id`: The unique identifier of the layer to update
- `l`: Specifies the properties to update

**Example:**

```tsx
const id = layer.id; // Get the layer ID from the addLayer return value

view.updateLayerById(id, {
  type: "tiles",
  data: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: {
    segments: 10,
    color: new Color().setStyle("#ffffff"),
    maxSse: 2,
    maxZoom: 23,
    wireframe: false,
  },
});
```

### updateMeshById()

Updates an existing mesh descriptor's configuration by its ID.
Accepts the same descriptor shape as `addMesh()`.

**Syntax:**

```tsx
updateMeshById(id: string, updates: OmitType<MeshConfig | D["mesh"]>): void
```

**Parameters:**

- `id`: The unique identifier of the mesh to update
- `updates`: Configuration object with properties to update (same shape as `addMesh()`)

**Example:**

```tsx
const handle = view.addMesh<BoxMeshDesc>({ box: { width: 100 } });

view.updateMeshById(handle.id, { box: { width: 200 } });
```

### updateLightById()

Updates an existing light descriptor's configuration by its ID.
Accepts the same descriptor shape as `addLight()`.

**Syntax:**

```tsx
updateLightById(id: string, updates: OmitType<LightConfig | D["light"]>): void
```

**Parameters:**

- `id`: The unique identifier of the light to update
- `updates`: Configuration object with properties to update (same shape as `addLight()`)

**Example:**

```tsx
const handle = view.addLight<SunLightDesc>({ sun: { intensity: 1.0 } });

view.updateLightById(handle.id, { sun: { intensity: 0.5 } });
```

### updateEffectById()

Updates an existing effect descriptor's configuration by its ID.
Accepts the same descriptor shape as `addEffect()`.

**Syntax:**

```tsx
updateEffectById(id: string, updates: OmitType<BuiltInEffectDescription | EffectConfig | D["effect"]>): void
```

**Parameters:**

- `id`: The unique identifier of the effect to update
- `updates`: Configuration object with properties to update (same shape as `addEffect()`)

**Example:**

```tsx
const handle = view.addEffect<SSAOEffectDesc>({ ssao: { radius: 0.5 } });

view.updateEffectById(handle.id, { ssao: { radius: 1.0 } });
```

### deleteLayerById()

Deletes a resource layer from the scene by its ID.

**Syntax:**

```tsx
deleteLayerById(id: string): boolean
```

**Parameters:**

- `id`: The unique identifier of the layer to delete

**Returns:** `true` if the layer was found and deleted, `false` otherwise.

**Example:**

```tsx
const id = layer.id;

view.deleteLayerById(id);
```

### deleteMeshById()

Deletes a mesh descriptor from the scene by its ID.

**Syntax:**

```tsx
deleteMeshById(id: string): boolean
```

**Parameters:**

- `id`: The unique identifier of the mesh to delete

**Returns:** `true` if the mesh was found and deleted, `false` otherwise.

**Example:**

```tsx
view.deleteMeshById(handle.id);
```

### deleteLightById()

Deletes a light descriptor from the scene by its ID.

**Syntax:**

```tsx
deleteLightById(id: string): boolean
```

**Parameters:**

- `id`: The unique identifier of the light to delete

**Returns:** `true` if the light was found and deleted, `false` otherwise.

**Example:**

```tsx
view.deleteLightById(handle.id);
```

### deleteEffectById()

Deletes an effect descriptor from the scene by its ID.

**Syntax:**

```tsx
deleteEffectById(id: string): boolean
```

**Parameters:**

- `id`: The unique identifier of the effect to delete

**Returns:** `true` if the effect was found and deleted, `false` otherwise.

**Example:**

```tsx
view.deleteEffectById(handle.id);
```

### init()

Initializes the 3D engine and WASM modules, and starts the main rendering loop. You must call this method before using the view.

**Syntax:**

```tsx
async init(): Promise<void>
```

**Returns:**

A `Promise<void>` that resolves when initialization is complete.

**Example:**

```tsx
const view = new ThreeView();
await view.init();

// Add layers after init()
view.addLayer({
  type: "tiles",
  data: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" },
  rasterTile: { maxZoom: 19 },
});
```

### dispose()

Releases all resources and stops the rendering loop. Call this method when the view is no longer needed.

**Syntax:**

```tsx
dispose(): void
```

**Example:**

```tsx
// Cleanup on component unmount
view.dispose();
```

### resize()

Changes the renderer size and updates the camera aspect ratio. Automatically called on window resize unless `disableAutoResize` is `true`.

**Syntax:**

```tsx
resize(width?: number, height?: number, pixelRatio?: number): void
```

**Parameters:**

- `width`: New width (pixels). Uses canvas size when omitted
- `height`: New height (pixels). Uses canvas size when omitted
- `pixelRatio`: Device pixel ratio

**Example:**

```tsx
// Resize with explicit dimensions
view.resize(1920, 1080, 2);

// Resize using current canvas size (only updating pixel ratio)
view.resize(undefined, undefined, window.devicePixelRatio);
```

### setCamera()

Sets the camera position and orientation immediately. Moves the camera directly without animation.

**Syntax:**

```tsx
setCamera(camPos: CameraPosition): void
```

**Parameters:**

- `camPos`: Camera position and orientation

```tsx
type CameraPosition = {
  lng?: number;
  lat?: number;
  height?: number;
  pitch?: number;
  heading?: number;
  roll?: number;
};
```

**Example:**

```tsx
view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  pitch: -45,
  heading: 0,
  roll: 0,
});
```

### moveCamera()

Moves the camera in the specified direction by the specified amount.

**Syntax:**

```tsx
moveCamera(move: CameraDirection, amount: number): void
```

**Parameters:**

- `move`: Camera movement direction
- `amount`: Amount to move (meters)

`CameraDirection` is an enum with the following values:

```tsx
enum CameraDirection {
  Forward,
  Backward,
  Left,
  Right,
  Up,
  Down,
}
```

**Example:**

```tsx
import ThreeView, { CameraDirection } from "@navara/three";

view.moveCamera(CameraDirection.Forward, 100);
view.moveCamera(CameraDirection.Up, 50);
```

### moveCameraWithDirection()

Moves the camera with a custom direction vector.

**Syntax:**

```tsx
moveCameraWithDirection(dir: number[], amount: number): void
```

**Parameters:**

- `dir`: [x, y, z] direction vector
- `amount`: Amount to move (meters)

**Example:**

```tsx
view.moveCameraWithDirection([1, 0, 0], 100);
```

### flyTo()

Animates the camera to a target position. Moves smoothly along a flight arc.

**Syntax:**

```tsx
flyTo(
  camPos: CameraPosition & Required<Pick<CameraPosition, "lng" | "lat" | "height">>,
  duration?: number,
  maxHeight?: number
): void
```

**Parameters:**

- `camPos`: Target position. `lng`, `lat`, and `height` are required
  - `lng`: Longitude (degrees)
  - `lat`: Latitude (degrees)
  - `height`: Height (meters)
  - `pitch`: Pitch angle (degrees)
  - `heading`: Heading angle (degrees)
  - `roll`: Roll angle (degrees)
- `duration`: Animation duration (milliseconds)
- `maxHeight`: Maximum height during the flight arc (meters)

**Example:**

```tsx
// Fly to Tokyo over 3 seconds (maximum height 5000m)
view.flyTo(
  {
    lng: 139.7671,
    lat: 35.6812,
    height: 1000,
    pitch: -45,
    heading: 0,
  },
  3000,
  5000
);
```

### lookAt()

Points the camera at a target position and places it at an offset position. The offset is specified in the East-North-Up (ENU) coordinate system.

**Syntax:**

```tsx
lookAt(target: LatLngHeight, offset: Vector3): void
```

**Parameters:**

- `target`: Target geodetic position
  - `lng`: Longitude (degrees)
  - `lat`: Latitude (degrees)
  - `height`: Height (meters)
- `offset`: Offset from the target (ENU coordinate system, meters)
  - `x`: East direction
  - `y`: North direction
  - `z`: Up direction

**Example:**

```tsx
import { Vector3 } from "three";

// Look down at Tokyo Tower from 1000m above
view.lookAt(
  { lng: 139.7454, lat: 35.6586, height: 0 },
  new Vector3(0, 0, 1000) // 1000m directly above
);

// View from a diagonal behind
view.lookAt(
  { lng: 139.7454, lat: 35.6586, height: 0 },
  new Vector3(500, -500, 500) // 500m east, 500m south, 500m up
);
```

### cameraFollow()

Enables or disables camera follow mode. When enabled, the camera moves centered on the specified target position.

**Syntax:**

```tsx
cameraFollow(enabled: boolean, target?: LatLngHeight, offset?: Vector3): void
```

**Parameters:**

- `enabled`: Whether to enable follow mode
- `target`: Target position to center on
  - `lng`: Longitude (degrees)
  - `lat`: Latitude (degrees)
  - `height`: Height (meters)
- `offset`: Offset from the target (ENU coordinate system, meters)

**Example:**

```tsx
import { Vector3 } from "three";

view.cameraFollow(
  true,
  { lng: 139.7671, lat: 35.6812, height: 100 },
  new Vector3(0, -200, 100) // 200m south, 100m up
);

// Disable follow mode
view.cameraFollow(false);
```

### sampleTerrainHeight()

Synchronously gets the terrain height at a specified geodetic position. Returns `undefined` if terrain data has not yet been loaded.

**Syntax:**

```tsx
sampleTerrainHeight(pos: LatLngHeight): number | undefined
```

**Parameters:**

- `pos`: Geodetic position
  - `lat`: Latitude (radians)
  - `lng`: Longitude (radians)
  - `height`: Ignored

**Returns:**

Terrain height (meters), or `undefined` if terrain data is not available

**Example:**

```tsx
// Specify latitude and longitude in radians
const lat = degreeToRadian(35.6812);
const lng = degreeToRadian(139.7671);

const height = view.sampleTerrainHeight({
  lat,
  lng,
  height: 0,
});

if (height !== undefined) {
  console.log(`Terrain height: ${height}m`);
} else {
  console.log("Terrain data has not been loaded yet");
}
```

### observeTerrainHeightAt()

Monitors terrain height changes at a specific position. The callback is invoked whenever the terrain data is updated.

**Syntax:**

```tsx
observeTerrainHeightAt(pos: LatLng, cb: (height: number) => void): () => void
```

**Parameters:**

- `pos`: Position to monitor
  - `lat`: Latitude (radians)
  - `lng`: Longitude (radians)
- `cb`: Callback invoked when the height is updated

**Returns:**

A cleanup function to stop monitoring

**Example:**

```tsx
// Specify latitude and longitude in radians
const lat = degreeToRadian(35.6812);
const lng = degreeToRadian(139.7671);

const cleanup = view.observeTerrainHeightAt({ lat, lng }, (height) => {
  console.log(`Terrain height updated: ${height}m`);
});

// Stop monitoring later
cleanup();
```

### rotateAroundAxis()

Rotates the camera around a specified axis. Specifying a zero vector uses the default axis.

**Syntax:**

```tsx
rotateAroundAxis(axis: Vector3, angle: number): void
```

**Parameters:**

- `axis`: Rotation axis
- `angle`: Rotation angle (radians)

**Example:**

```tsx
import { Vector3 } from "three";

// Rotate 45 degrees around the Y axis
view.rotateAroundAxis(new Vector3(0, 1, 0), Math.PI / 4);
```

### rotateAround()

Rotates the camera around the current look-at point or the center of the view.

**Syntax:**

```tsx
rotateAround(angle: number): void
```

**Parameters:**

- `angle`: Rotation angle (radians)

**Example:**

```tsx
// Rotate 45 degrees
view.rotateAround(Math.PI / 4);

// Auto-rotation animation
const animate = () => {
  view.rotateAround(0.005);
  requestAnimationFrame(animate);
};
animate();
```

### forceUpdate()

Forces the scene to re-render on the next frame. Used to manually trigger an update when `animation: false`.

**Syntax:**

```tsx
forceUpdate(): void
```

**Example:**

```tsx
view.forceUpdate();
```

### pickTerrainPosition()

Picks the terrain position at the given screen coordinates. Uses the same CSS pixel coordinates as `clientX` and `clientY` from mouse events.

**Syntax:**

```tsx
pickTerrainPosition(x: number, y: number): Vector3 | null
```

**Parameters:**

- `x`: Screen X coordinate (CSS pixels, same as `MouseEvent.clientX`)
- `y`: Screen Y coordinate (CSS pixels, same as `MouseEvent.clientY`)

**Returns:**

World position (ECEF coordinates), or `null` if no terrain is hit

**Example:**

```tsx
// Get terrain coordinates at the click position
view.on("click", (event) => {
  const position = view.pickTerrainPosition(event.clientX, event.clientY);
  if (position) {
    console.log(`ECEF coordinates: ${position.x}, ${position.y}, ${position.z}`);
  } else {
    console.log("No terrain hit");
  }
});
```

### registerMesh()

Registers a custom mesh descriptor class.

**Syntax:**

```tsx
registerMesh(name: string, meshClass: MeshDescConstructor): void
```

**Parameters:**

- `name`: Name of the mesh descriptor to register
- `meshClass`: Constructor of the mesh descriptor

**Example:**

```tsx
class CustomMeshDesc extends MeshDesc {
  onCreate() {
    // Custom implementation
  }
}

view.registerMesh("customMesh", CustomMeshDesc);
```

### registerLight()

Registers a custom light descriptor class.

**Syntax:**

```tsx
registerLight(name: string, lightClass: LightDescConstructor): void
```

**Parameters:**

- `name`: Name of the light descriptor to register
- `lightClass`: Constructor of the light descriptor

**Example:**

```tsx
class CustomLightDesc extends LightDesc {
  onCreate() {
    // Custom implementation
  }
}

view.registerLight("customLight", CustomLightDesc);
```

### registerEffect()

Registers a custom effect descriptor class.

**Syntax:**

```tsx
registerEffect(name: string, effectClass: EffectDescConstructor): void
```

**Parameters:**

- `name`: Name of the effect descriptor to register
- `effectClass`: Constructor of the effect descriptor

**Example:**

```tsx
class CustomEffectDesc extends EffectDesc {
  onCreate() {
    // Custom implementation
  }
}

view.registerEffect("customEffect", CustomEffectDesc);
```

### addPlugin()

Registers a plugin. Must be called before `view.init()`.

**Syntax:**

```tsx
addPlugin(plugin: Plugin): this
```

**Parameters:**

- `plugin`: A `Plugin` instance

**Example:**

```typescript
const view = new ThreeView({});
view.addPlugin(pluginA).addPlugin(pluginB);
await view.init();
```

### addFontFamily()

Registers a font family composed of multiple faces. Each face covers a set of unicode ranges and points to a separate font file URL (ttf, otf, woff, or woff2). Once a family is registered, a text layer can reference it by its `family` name through [`material.font`](../../resource-layer/text-material/#font); only the faces whose unicode ranges cover the characters in the label's `text` are downloaded.

**Face priority and fallback:**

- Faces are evaluated in the order they appear in `faces`. For each codepoint in `text`, the first face whose `unicodeRanges` contain it is used — so if ranges overlap, the earlier entry wins.
- Codepoints that are not covered by any face fall back to the first face (`faces[0]`). This means the first face may also be downloaded for uncovered characters, even if its declared `unicodeRanges` do not include them.

To make this behavior predictable, put the face you want used as the fallback at index `0`. Then order the remaining faces after it so that, when their ranges overlap, earlier entries have higher priority.

Returns the `ThreeView` instance so calls can be chained.

**Syntax:**

```tsx
addFontFamily(family: FontFamily): this
```

**Parameters:**

- `family`: A `FontFamily` object.
  - `family`: Unique name used to reference the family from `material.font`.
  - `faces`: Array of `FontFace` entries, each with:
    - `url`: URL of the font file.
    - `unicodeRanges`: Array of `{ from, to }` code point ranges (inclusive) covered by this face.

**Example:**

```typescript
view.addFontFamily({
  family: "MapFont",
  faces: [
    {
      url: "/fonts/latin.woff2",
      unicodeRanges: [{ from: 0x0000, to: 0x024f }],
    },
    {
      url: "/fonts/cjk.woff2",
      unicodeRanges: [{ from: 0x4e00, to: 0x9fff }],
    },
  ],
});

view.addLayer({
  type: "geojson",
  url: "/cities.geojson",
  text: {
    text: ["get", "name"],
    font: "MapFont",
  },
});
```

### removeFontFamily()

Unregisters a previously added font family by name. Text layers that still reference the family will no longer be able to resolve it.

Returns the `ThreeView` instance so calls can be chained.

**Syntax:**

```tsx
removeFontFamily(family: string): this
```

**Parameters:**

- `family`: The `family` name passed to `addFontFamily()`.

**Example:**

```typescript
view.removeFontFamily("MapFont");
```
