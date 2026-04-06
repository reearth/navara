---
title: FeatureEvaluator
description: API Reference for FeatureEvaluator class
sidebar:
  order: 17
---

FeatureEvaluator is a class that provides access to feature data and dynamic styling of features based on their properties. It can be obtained through the `featureCreated` and `featureUpdated` events of a Layer.

This class allows you to:
- Read feature properties from data sources
- Dynamically style features based on their properties

:::note
For detailed parameter types of events, see [Layer Types](./layer-types#events).
:::

## Properties

### id

**Type:** `FeatureId`

**Description:** Gets the unique identifier of this feature.

**Example:**

```typescript
layer.on("featureCreated", ({ evaluator }) => {
  console.log("Feature ID:", evaluator.id);
});
```

## Types

### FeatureInfo

```typescript
type FeatureInfo = {
  batchIndex: number;
  batchId: number;
  properties: Record<string, unknown> | undefined;
};
```

### FeatureEvaluatorCallback

```typescript
type FeatureEvaluatorCallback = (
  info: FeatureInfo,
) => Partial<EvaluatedValue>;
```

## Methods

### readFeatureProperties()

Reads the properties of this feature from the data source. The callback is invoked for each batch within this feature.

**Syntax:**

```typescript
readFeatureProperties(
  f: (info: FeatureInfo) => void
): void
```

**Parameters:**

- `f`: A callback function that receives a FeatureInfo object for each batch

**Example:**

```typescript
// Log all properties
evaluator.readFeatureProperties(({ batchId, properties }) => {
  console.log(`Batch ${batchId}:`, properties);
});

evaluator.readFeatureProperties(({ properties }) => {
  const attributes = properties?.["attributes"] ?? {};
  const minHeight = attributes["minHeight"];
  const maxHeight = attributes["maxHeight"];
  console.log("Height range:", minHeight, "-", maxHeight);
});
```

### readFilteredFeatureProperties()

Reads only the specified root property keys of this feature from the data source. More efficient than `readFeatureProperties()` when only a few properties are needed.

**Syntax:**

```typescript
readFilteredFeatureProperties(
  keys: string[],
  f: (info: FeatureInfo) => void
): void
```

**Parameters:**

- `keys`: An array of root property keys to read
- `f`: A callback function that receives a FeatureInfo object with only the filtered properties

**Example:**

```typescript
evaluator.readFilteredFeatureProperties(["height", "name"], ({ batchId, properties }) => {
  console.log(`Batch ${batchId}: height=${properties?.["height"]}, name=${properties?.["name"]}`);
});
```

### evaluate()

Evaluates and applies dynamic styles to features based on their properties. The callback is invoked for each batch (sub-feature) within this feature.

**Syntax:**

```typescript
evaluate(
  f: FeatureEvaluatorCallback,
  options?: {
    filters?: string[];
  }
): void
```

**Parameters:**

- `f`: A callback function that receives a FeatureInfo object and returns style values
- `options`: Optional configuration
  - `options.filters`: An array of root property keys to read. When specified, only the matched properties are passed to the callback, improving performance for large datasets.

**Returns:**

The callback function can return an object containing the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `color` | `Color` | Feature color (using `new Color()`) |
| `show` | `boolean` | Feature visibility (show/hide) |
| `height` | `number` | Feature height (meters) |
| `extrudedHeight` | `number` | Polygon extrusion height (meters) |
| `text` | `string` | Label text content (for text/label features) |

:::note
Evaluated styles override the layer's default styles.
:::

**Example:**

```typescript
import { Color } from "@navara/three";

// Color 3D Tiles buildings by height
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const measuredHeight = properties?.["height"] as number;

    const color = (() => {
      if (measuredHeight < 30) return new Color().setStyle("#00ff00");
      if (measuredHeight < 60) return new Color().setStyle("#ffff00");
      if (measuredHeight < 90) return new Color().setStyle("#ff00ff");
      return new Color().setStyle("#ff0000");
    })();

    return {
      color,
      show: measuredHeight >= 30, // Hide low buildings
    };
  });
});
```

```typescript
// Apply property-based extrusion to GeoJSON polygons
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const height = (properties?.["height"] as number) ?? 0;
    const extrudedHeight = (properties?.["extrudedHeight"] as number) ?? 0;

    return {
      height,
      extrudedHeight,
    };
  });
});
```

```typescript
// Color MVT features by category property
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const category = properties?.["category"] as string;

    const color = (() => {
      if (category === "A") return "#0000ff";
      if (category === "B") return "#00ff00";
      return "#ff0000";
    })();

    return {
      color: new Color().setStyle(color),
    };
  });
});
```

```typescript
// Filter and style text labels
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const text = properties?.["name"] as string;

    return {
      text,
      show: !!text,
    };
  });
});
```

```typescript
// Highlight selected feature with pick event
let selectedId: string | undefined;

// Select feature on click
view.on("pick", (info) => {
  selectedId = info?.properties?.["id"] as string;
  layer.forceUpdate(); // Re-evaluate styles
});

// Change color based on selection state
layer.on("featureUpdated", ({ evaluator }) => {
  evaluator.evaluate(({ properties }) => {
    const id = properties?.["id"] as string;

    return {
      color: new Color().setHex(selectedId === id ? 0xff0000 : 0xffffff),
    };
  });
});
```

## EvaluatedValue Type

Type definition that can be returned from the `evaluate()` callback:

```typescript
type EvaluatedValue = {
  /** Feature color */
  color?: Color;
  /** Feature visibility (show/hide) */
  show?: boolean;
  /** Polygon extrusion height (meters) */
  extrudedHeight?: number;
  /** Feature height (meters) */
  height?: number;
  /** Label text content */
  text?: string;
};
```

:::tip[Recommendation]
Only return the properties you want to change from `evaluate()`. All properties are optional.
:::
