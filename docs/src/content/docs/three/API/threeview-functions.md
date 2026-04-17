---
title: ThreeView Functions
description: API Reference for ThreeView Class Functions
sidebar:
  order: 13
---

This page describes all functions (methods) available on a ThreeView instance.

## Methods

### addLayer()

Adds a new resource layer to navara_three. This method is used for resource layers only (tiles, terrain, geojson, mvt, cesium3dtiles, b3dm, pnts). For mesh, light, and effect layers, use `addMesh()`, `addLight()`, and `addEffect()` respectively.

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

Adds a new mesh layer to navara_three. The mesh layer class must be registered with `registerMesh()` before calling this method.

**Syntax:**

```tsx
addMesh<L = unknown>(l: MeshLayerDescription): LayerHandle<L>
```

**Returns:**

```tsx
LayerHandle<L>;
```

Returns a `LayerHandle<L>` for controlling the mesh layer.

**Example:**

```tsx
// SkyMeshLayer must be registered
const skyHandle = view.addMesh<SkyMeshLayer>({ sky: {} });
```

### addLight()

Adds a new light layer to navara_three. The light layer class must be registered with `registerLight()` before calling this method.

**Syntax:**

```tsx
addLight<L = unknown>(l: LightLayerDescription): LayerHandle<L>
```

**Returns:**

```tsx
LayerHandle<L>;
```

Returns a `LayerHandle<L>` for controlling the light layer.

**Example:**

```tsx
// SunLightLayer must be registered
const sunHandle = view.addLight<SunLightLayer>({ sun: { intensity: 1.0 } });
```

### addEffect()

Adds a new effect layer to navara_three. The effect layer class must be registered with `registerEffect()` before calling this method.

**Syntax:**

```tsx
addEffect<L = unknown>(l: EffectLayerDescription): LayerHandle<L>
```

**Returns:**

```tsx
LayerHandle<L>;
```

Returns a `LayerHandle<L>` for controlling the effect layer.

**Example:**

```tsx
// FXAAEffectLayer must be registered
const fxaaHandle = view.addEffect<FXAAEffectLayer>({ fxaa: {} });
```

### updateLayerById()

Updates a specific layer on navara_three.

**Syntax:**

```tsx
updateLayerById(layerId: string, l: LayerDescription): void
```

**Parameters:**

- `layerId`: The ID of the layer to update
- `l`: Specifies the properties to update

**Example:**

```tsx
const layerId = layer.id; // Get the layer ID from the addLayer return value

view.updateLayerById(layerId, {
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

### deleteLayerById()

Deletes a specific layer from navara_three.

**Syntax:**

```tsx
deleteLayerById(layerId: string): void
```

**Parameters:**

- `layerId`: The ID of the layer to delete

**Example:**

```tsx
const layerId = layer.id;

view.deleteLayerById(layerId);
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

Registers a custom mesh layer class.

**Syntax:**

```tsx
registerMesh(name: string, meshClass: MeshLayerConstructor): void
```

**Parameters:**

- `name`: Name of the mesh layer to register
- `meshClass`: Constructor of the mesh layer

**Example:**

```tsx
class CustomMeshLayer extends MeshLayer {
  onCreate() {
    // Custom implementation
  }
}

view.registerMesh("customMesh", CustomMeshLayer);
```

### registerLight()

Registers a custom light layer class.

**Syntax:**

```tsx
registerLight(name: string, lightClass: LightLayerConstructor): void
```

**Parameters:**

- `name`: Name of the light layer to register
- `lightClass`: Constructor of the light layer

**Example:**

```tsx
class CustomLightLayer extends LightLayer {
  onCreate() {
    // Custom implementation
  }
}

view.registerLight("customLight", CustomLightLayer);
```

### registerEffect()

Registers a custom effect layer class.

**Syntax:**

```tsx
registerEffect(name: string, effectClass: EffectLayerConstructor): void
```

**Parameters:**

- `name`: Name of the effect layer to register
- `effectClass`: Constructor of the effect layer

**Example:**

```tsx
class CustomEffectLayer extends EffectLayer {
  onCreate() {
    // Custom implementation
  }
}

view.registerEffect("customEffect", CustomEffectLayer);
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
