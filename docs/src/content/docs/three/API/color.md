---
title: Color Class
description: API Reference for Color Class - a class for representing colors
sidebar:
  order: 18
---

The `Color` class is a class for representing colors. It manages colors based on the sRGB color space and supports setting and getting colors in various formats.

## Basic Usage

The `Color` class uses method chaining to set colors. The constructor takes no arguments, and colors are set using one of the `setRGB()`, `setHex()`, or `setStyle()` methods.

```typescript
import { Color } from "@navara/three";

// Set by RGB values (each component is 0.0-1.0)
const red = new Color().setRGB(1.0, 0.0, 0.0);

// Set by hexadecimal
const green = new Color().setHex(0x00ff00);

// Set by CSS color string
const blue = new Color().setStyle("#0000ff");
```

## Methods

### setRGB()

Sets the color by RGB values (sRGB color space).

**Syntax:**

```typescript
setRGB(r: number, g: number, b: number): this
```

**Parameters:**

- `r`: Red component (0.0-1.0)
- `g`: Green component (0.0-1.0)
- `b`: Blue component (0.0-1.0)

**Returns:**

Returns its own instance for method chaining.

**Example:**

```typescript
// Pure red
const red = new Color().setRGB(1.0, 0.0, 0.0);

// Orange
const orange = new Color().setRGB(1.0, 0.5, 0.0);

// Gray (50%)
const gray = new Color().setRGB(0.5, 0.5, 0.5);
```

---

### setRGBLinear()

Sets the color by RGB values (linear color space, no gamma correction).

**Syntax:**

```typescript
setRGBLinear(r: number, g: number, b: number): this
```

**Parameters:**

- `r`: Red component (0.0-1.0)
- `g`: Green component (0.0-1.0)
- `b`: Blue component (0.0-1.0)

**Returns:**

Returns its own instance for method chaining.

**Example:**

```typescript
// Set color in linear color space
const linearColor = new Color().setRGBLinear(0.5, 0.5, 0.5);
```

:::note
For typical use cases, use `setRGB()`. `setRGBLinear()` is used when linear color space is needed, such as for lighting calculations.
:::

---

### setHex()

Sets the color by hexadecimal value (sRGB color space).

**Syntax:**

```typescript
setHex(hex: number): this
```

**Parameters:**

- `hex`: Hexadecimal color value (e.g., `0xff0000` for red)

**Returns:**

Returns its own instance for method chaining.

**Example:**

```typescript
// Red
const red = new Color().setHex(0xff0000);

// Green
const green = new Color().setHex(0x00ff00);

// Blue
const blue = new Color().setHex(0x0000ff);

// White
const white = new Color().setHex(0xffffff);

// Black
const black = new Color().setHex(0x000000);
```

---

### setStyle()

Sets the color by CSS color string (sRGB color space).

**Syntax:**

```typescript
setStyle(style: string): this
```

**Parameters:**

- `style`: CSS color string

**Returns:**

Returns its own instance for method chaining.

**Supported formats:**

- Hexadecimal: `"#ff0000"`, `"#f00"`
- RGB: `"rgb(255, 0, 0)"`
- RGBA: `"rgba(255, 0, 0, 1)"`
- HSL: `"hsl(0, 100%, 50%)"`
- Named colors: `"red"`, `"blue"`, `"green"`, etc.

**Example:**

```typescript
// Hexadecimal format
const red = new Color().setStyle("#ff0000");
const shortRed = new Color().setStyle("#f00");

// RGB format
const green = new Color().setStyle("rgb(0, 255, 0)");

// HSL format
const blue = new Color().setStyle("hsl(240, 100%, 50%)");

// Named colors
const coral = new Color().setStyle("coral");
```

---

### copy()

Copies the values of this color to another Color instance.

**Syntax:**

```typescript
copy(color: Color): this
```

**Parameters:**

- `color`: The target Color instance to copy to

**Returns:**

The target Color instance with the copied values

**Example:**

```typescript
const original = new Color().setHex(0xff0000);
const target = new Color();

original.copy(target);
// target now has the same color as original
```

---

### clone()

Creates a new Color instance with the same values.

**Syntax:**

```typescript
clone(): Color
```

**Returns:**

A new Color instance

**Example:**

```typescript
const original = new Color().setHex(0xff0000);
const cloned = original.clone();

// original and cloned have the same color but are separate instances
```

---

### toArray()

Returns the color as an RGB array.

**Syntax:**

```typescript
toArray(): [r: number, g: number, b: number]
```

**Returns:**

`[red, green, blue]` values (each component is 0.0-1.0)

**Example:**

```typescript
const color = new Color().setHex(0xff8000);
const [r, g, b] = color.toArray();
// r ≈ 1.0, g ≈ 0.5, b = 0.0
```

---

### toHex()

Returns the color as a hexadecimal value.

**Syntax:**

```typescript
toHex(): number
```

**Returns:**

Hexadecimal color value (e.g., `0xff0000`)

**Example:**

```typescript
const color = new Color().setStyle("#ff8000");
const hex = color.toHex();
// hex = 0xff8000
```

---

### srgb()

Returns a new Color instance converted from linear color space to sRGB color space.

**Syntax:**

```typescript
srgb(): Color
```

**Returns:**

A new Color instance converted to sRGB color space

**Example:**

```typescript
const linearColor = new Color().setRGBLinear(0.5, 0.5, 0.5);
const srgbColor = linearColor.srgb();
```

## Properties

### raw

**Type:** `THREE.Color` (read-only)

**Description:** Provides access to the internal Three.js Color instance.

:::warning
This property is an internal implementation detail and is not needed for typical use. Only use it when direct integration with Three.js is required.
:::

## Usage Examples

### Usage with Materials

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Set the base color of the globe
view.globe.color = new Color().setStyle("#1a1a2e");
```

### Usage with Lights

```typescript
import ThreeView, { SunLightDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// Set the sunlight color
view.addLight<SunLightDesc>({
  sun: {
    color: new Color().setHex(0xffffff),
    intensity: 3,
  },
});
```

### Usage with ColorMap

```typescript
import { ColorMap, Color } from "@navara/three";

// ref: https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=9
const ylGnBu = new ColorMap("sequential", "YlGnBu", [
  new Color().setStyle("#ffffd9"),
  new Color().setStyle("#edf8b1"),
  new Color().setStyle("#c7e9b4"),
  new Color().setStyle("#7fcdbb"),
  new Color().setStyle("#41b6c4"),
  new Color().setStyle("#1d91c0"),
  new Color().setStyle("#225ea8"),
  new Color().setStyle("#253494"),
  new Color().setStyle("#081d58"),
]);
```

## See Also

- [ColorMap Class](../../../three/api-reference/colormap/) - Defining color gradients
- [Globe Class](../../../three/api-reference/globe/) - `color` property
- [SunLightDesc](../../../three/effect-desc-reference/sun-light-desc/) - Light color configuration
- [AmbientLightDesc](../../../three/effect-desc-reference/ambient-light-desc/) - Ambient light color configuration
