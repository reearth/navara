---
title: TextMaterial
description: Text material for navara_three
sidebar:
  order: 38
---

`TextMaterial` represents a material for text rendering.

## Properties

### backgroundColor

**Type:** `Color | undefined`

**Description:** Specifies the text background color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    backgroundColor: new Color().setHex(0xffffff) // White background
  }
}
```

### borderColor

**Type:** `Color | undefined`

**Description:** Specifies the text background border color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    borderColor: new Color().setHex(0x000000) // Black border
  }
}
```

### borderWidth

**Type:** `number | undefined`

**Description:** Specifies the text border width. Specified as a ratio to the frame height, between 0 and 0.5.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    borderWidth: 2
  }
}
```

### center

**Type:** [`Vec2`](#vec2) | undefined

**Description:** Specifies the shift amount from the center. The range is between 0 and 1.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    center: { x: 10, y: -5 }
  }
}
```

### clampToGround

**Type:** `boolean | undefined`

**Description:** Specifies whether to clamp the text to the ground.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** Specifies the text color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    color: new Color().setHex(0x000000)
  }
}
```

### cornerRadius

**Type:** `number | undefined`

**Description:** Specifies the corner radius of the text background. Specified as a ratio of the corner radius to the height, between 0 and 0.5.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    cornerRadius: 5
  }
}
```

### depthTest

**Type:** `boolean | undefined`

**Description:** A variable that determines whether front-facing models occlude back-facing models.

**Default:** `true`

**Example:**

```typescript
{
  text: {
    depthTest: true
  }
}
```

### font

**Type:** `string | undefined`

**Description:** Specifies either the URL of a single font file or the `family` name of a font family previously registered with [`view.addFontFamily()`](../../api/threeview-functions/#addfontfamily). Supported file formats are ttf, otf, woff, and woff2.

When a family name is used, only the face files whose unicode ranges cover the characters in `text` are fetched, so large scripts (CJK, etc.) can be split into multiple faces and loaded on demand.

For each codepoint, the first face (in `faces` order) whose `unicodeRanges` include the codepoint is used, so earlier entries win when ranges overlap. Codepoints not covered by any face fall back to the first face (`faces[0]`), which may therefore be downloaded even for characters outside its declared ranges. See [`addFontFamily()`](../../api/threeview-functions/#addfontfamily) for details.

**Default:** `undefined` (no font is loaded, and the text layer will not render until a font is specified).

**Example (single font file):**

```typescript
{
  text: {
    font: "https://example.com/fonts/NotoSansJP-Regular.ttf"
  }
}
```

**Example (registered font family):**

```typescript
view.addFontFamily({
  family: "MapFont",
  faces: [
    { url: "/fonts/latin.woff2", unicodeRanges: [{ from: 0x0000, to: 0x024f }] },
    { url: "/fonts/cjk.woff2", unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
  ],
});

// Later, in a text layer material:
{
  text: {
    font: "MapFont"
  }
}
```

You can also specify a font file obtained by using the [troika-three-text script](https://github.com/protectwise/troika/blob/main/packages/troika-three-text/find-google-font-url.js) to retrieve Google Fonts.

### height

**Type:** `number | undefined`

**Description:** Specifies the altitude of the text. The unit is meters.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    height: 100 // 100 meters
  }
}
```

### lang

**Type:** `string | undefined`

**Description:** Specifies the language code for text shaping (e.g., "en", "ja", "ar"). Used to correctly render text.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    lang: "ja"
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** Avoids overlap with the earth's surface. Use this to prevent the text from clipping into the earth's surface.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    offsetDepth: true
  }
}
```

### outlineBlur

**Type:** `number | undefined`

**Description:** Specifies the outline blur radius in CSS pixels.

**Default:** `0.0`

**Example:**

```typescript
{
  text: {
    outlineBlur: 2
  }
}
```

### outlineColor

**Type:** `Color | undefined`

**Description:** Specifies the text outline color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    outlineColor: new Color().setHex(0x000000) // Black outline
  }
}
```

### outlineOffset

**Type:** [`Vec2`](#vec2) | undefined

**Description:** Specifies the pixel offset `[x, y]` in CSS pixels.

**Default:** `(0.0, 0.0)`

**Example:**

```typescript
{
  text: {
    outlineOffset: { x: 1, y: 1 }
  }
}
```

### outlineOpacity

**Type:** `number | undefined`

**Description:** Specifies the opacity of the text outline. The range is 0.0 to 1.0.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    outlineOpacity: 0.8
  }
}
```

### outlineWidth

**Type:** `number | undefined`

**Description:** Specifies the outline thickness in CSS pixels.

**Default:** `0.0`

**Example:**

```typescript
{
  text: {
    outlineWidth: 2
  }
}
```

### padding

**Type:** [`Vec2`](#vec2) | undefined

**Description:** Specifies the text padding. The unit is pixels.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    padding: { x: 5, y: 3 }
  }
}
```

### sizeInMeters

**Type:** `boolean | undefined`

**Description:** Whether the size is specified in meters. If false, the size is in pixels.

**Default:** `true`

**Example:**

```typescript
{
  text: {
    sizeInMeters: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the text.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    show: true
  }
}
```

### size

**Type:** `number | undefined`

**Description:** Specifies the size of the text. The unit is pixels.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    size: 16
  }
}
```

### text

**Type:** `string | undefined`

**Description:** Specifies the text content to display.

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    text: "Tokyo Station"
  }
}
```

## Vec2

A class representing a 2D vector.

### Properties

#### x

**Type:** `number`

**Description:** X coordinate value.

#### y

**Type:** `number`

**Description:** Y coordinate value.
