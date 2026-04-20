---
title: Layer Types
description: API Reference for Layer, LayerHandle, and LayerDeclaration types
sidebar:
  order: 15
---

In navara_three, layers are classified into the following 4 types:

1. **Resource Layers** - Layers that load and display geographic data from external data sources (raster tiles, terrain, GeoJSON, 3D Tiles, etc.)
2. **Mesh Layers** - Layers that add 3D mesh objects to the scene
3. **Effect Layers** - Layers that apply post-processing effects
4. **Light Layers** - Layers that manage scene lighting

Resource layers and other layers (mesh, effect, light) return different handle classes.

## Layer

A handle class for controlling resource layers (imagery, terrain, GeoJSON, 3D Tiles, etc.). Returned when adding a resource layer with `ThreeView.addLayer()`.

### Properties

#### id

**Type:** `string`

**Description:** The unique identifier of the layer.

### Methods

#### update()

Updates the layer settings.

**Syntax:**

```typescript
update(l: LayerDescription): void
```

**Parameters:**

- `l`: New layer settings

**Example:**

```typescript
const geoJsonLayer = view.addLayer({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0xff0000 },
});

// Update layer settings
geoJsonLayer.update({
  type: "geojson",
  data: { url: "https://example.com/data.geojson" },
  point: { color: 0x00ff00 },
});
```

#### delete()

Removes the layer from the scene and releases resources. Do not use the layer after deletion.

**Syntax:**

```typescript
delete(): void
```

**Example:**

```typescript
geoJsonLayer.delete();
```

#### forceUpdate()

Marks the layer for update on the next frame. Call this when you need to trigger `featureUpdated` events.

**Syntax:**

```typescript
forceUpdate(): void
```

**Example:**

```typescript
// Trigger re-evaluation after style changes
layer.forceUpdate();
```

### Events

:::note
For the data structure behind these events (Layer, FeatureSet, Feature, Batch), see [About Layer](../../introduction/about-layer/#resource-layer-data-structure). For the `FeatureEvaluator` class used in event callbacks, see [FeatureEvaluator](./feature-evaluator/).
:::

#### featureCreated

**Description:** Fires when a new feature is created within the layer.

**Handler Type:**

```typescript
(params: FeatureCreatedParams) => void
```

**FeatureCreatedParams:**

| Property | Type | Description |
|----------|------|-------------|
| `featureSetId` | `FeatureSetId` | Unique identifier of the created feature set |
| `evaluator` | `FeatureEvaluator` | Evaluator class used for feature styling |
| `credit` | `string \| undefined` | Data source credit information (optional) |

**Example:**

```typescript
layer.on("featureCreated", ({ evaluator }) => {
  console.log("Feature created:", evaluator.id);
});
```

#### featureUpdated

**Description:** Fires when a feature within the layer is updated.

**Handler Type:**

```typescript
(params: FeatureUpdatedParams) => void
```

**FeatureUpdatedParams:**

| Property | Type | Description |
|----------|------|-------------|
| `featureSetId` | `FeatureSetId` | Unique identifier of the updated feature set |
| `evaluator` | `FeatureEvaluator` | Evaluator class used for feature styling |
| `updatedAt` | `number` | Update timestamp |

**Example:**

```typescript
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate((_batchId, property) => {
    const height = property?.["height"] as number;
    return {
      color: new Color().setStyle(height > 50 ? "#ff0000" : "#00ff00"),
    };
  });
});
```

#### featureVisibilityChanged

**Description:** Fires when the visibility of a feature changes.

**Handler Type:**

```typescript
(params: FeatureVisibilityChangedParams) => void
```

**FeatureVisibilityChangedParams:**

| Property | Type | Description |
|----------|------|-------------|
| `featureSetId` | `FeatureSetId` | Identifier of the feature set whose visibility changed |

#### featureRemoved

**Description:** Fires when a feature is removed from the layer.

**Handler Type:**

```typescript
(params: FeatureRemovedParams) => void
```

**FeatureRemovedParams:**

| Property | Type | Description |
|----------|------|-------------|
| `featureSetId` | `FeatureSetId` | Identifier of the removed feature set |

#### deleted

**Description:** Fires when the layer is deleted.

**Handler Type:**

```typescript
() => void
```

**Example:**

```typescript
layer.on("deleted", () => {
  console.log("Layer has been deleted");
});
```

---

## LayerHandle

A handle class for controlling mesh layers, light layers, and effect layers. Returned when adding a layer with `ThreeView.addMesh()`, `ThreeView.addLight()`, or `ThreeView.addEffect()`.

### Properties

#### id

**Type:** `string`

**Description:** The unique identifier of the layer.

**Example:**

```typescript
// SkyMeshLayer must be registered
const skyHandle = view.addMesh<SkyMeshLayer>({ sky: {} });
console.log("Layer ID:", skyHandle.id);
```

#### visible

**Type:** `boolean`

**Description:** Whether the layer is visible in the scene.

**Example:**

```typescript
// Check visibility
console.log("Visible:", skyHandle.visible);

// Toggle visibility
skyHandle.visible = false;
```

#### ref

**Type:** `T` (subclass of LayerDeclaration)

**Description:** Provides direct access to the underlying layer instance. Use this to access layer-specific methods and properties not exposed through the handle.

**Example:**

```typescript
// SkyMeshLayer must be registered
const skyHandle = view.addMesh<SkyMeshLayer>({ sky: {} });

// Access the underlying layer instance
const skyLayer = skyHandle.ref;
```

### Methods

#### update()

Updates layer settings with a partial update. Only the specified properties are changed; others remain unchanged.

**Syntax:**

```typescript
update(updates: UpdateConfig): void
```

**Parameters:**

- `updates`: A partial configuration object containing the properties to update

**Example:**

```typescript
// SkyMeshLayer must be registered
const skyHandle = view.addMesh<SkyMeshLayer>({ sky: {} });

// Update settings
skyHandle.update({ sunAngularRadius: 0.05 });
```

#### delete()

Removes the layer from the scene and releases resources. Do not use the handle after deletion.

**Syntax:**

```typescript
delete(): void
```

**Example:**

```typescript
skyHandle.delete();
```

### Events

#### deleted

**Description:** Fires when the layer is deleted.

**Handler Type:**

```typescript
() => void
```

**Example:**

```typescript
skyHandle.on("deleted", () => {
  console.log("Sky layer has been deleted");
});
```

---

## LayerDeclaration

An abstract base class for mesh layers, light layers, and effect layers. Extend this class to create custom layer types.

These layers differ from resource layers in that they are purely client-side and do not load data from external sources. They directly create Three.js objects.

### Type Parameters

- `Config` - The layer configuration type (extends LayerDeclarationConfig)
- `UpdateConfig` - Updatable configuration properties (extends LayerDeclarationConfigUpdate)
- `Instance` - The underlying Three.js object type that the layer creates
- `CustomEvent` - Additional custom events that the layer can fire

### Properties

#### id

**Type:** `string`

**Description:** The unique identifier of the layer. Specified via `config.id` or auto-generated.

#### visible

**Type:** `boolean`

**Description:** Gets or sets whether the layer is currently visible.

### Methods

#### onCreate() (abstract)

Called when the layer is added to the scene. Override to create Three.js objects. You must initialize `this._instance` and add it to the appropriate scene here.

**Syntax:**

```typescript
abstract onCreate(): void
```

#### onUpdateConfig()

Called when the layer configuration is updated via `LayerHandle.update()`. Override to handle custom configuration updates.

**Syntax:**

```typescript
onUpdateConfig(updates: UpdateConfig): void
```

**Parameters:**

- `updates`: The configuration properties being updated

#### onDestroy()

Called when the layer is removed via `LayerHandle.delete()`. Override to clean up resources. Remember to call `super.onDestroy()`.

**Syntax:**

```typescript
onDestroy(): void
```

### Example

```typescript
import { LayerDeclaration, type LayerDeclarationConfig } from "@navara/three";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

// Define custom configuration type
type MyBoxConfig = LayerDeclarationConfig & {
  size?: number;
  color?: number;
};

// Create custom layer
class MyBoxLayer extends LayerDeclaration<MyBoxConfig, MyBoxConfig, Mesh> {
  private size: number;
  private color: number;

  constructor(view: ThreeView, ctx: ViewContext, config: MyBoxConfig) {
    super(view, ctx, config);
    this.size = config.size ?? 1;
    this.color = config.color ?? 0xff0000;
  }

  onCreate() {
    const geometry = new BoxGeometry(this.size, this.size, this.size);
    const material = new MeshBasicMaterial({ color: this.color });
    this._instance = new Mesh(geometry, material);
    this.ctx.scenes.opaque.add(this._instance);
  }

  onUpdateConfig(updates: MyBoxConfig) {
    super.onUpdateConfig(updates);

    if (updates.color !== undefined && this._instance) {
      (this._instance.material as MeshBasicMaterial).color.set(updates.color);
    }
  }

  onDestroy() {
    if (this._instance) {
      this.ctx.scenes.opaque.remove(this._instance);
      this._instance.geometry.dispose();
      (this._instance.material as MeshBasicMaterial).dispose();
    }
    super.onDestroy();
  }
}
```

### LayerDeclarationConfig

Base configuration options common to all mesh, effect, and light layers.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string \| undefined` | Auto-generated | Custom ID for the layer |
| `visible` | `boolean \| undefined` | `true` | Whether to display the layer |
