---
title: ModelMaterial
description: Model material for navara_three
sidebar:
  order: 32
---

`ModelMaterial` represents a material for 3D model rendering.

## Properties

### animationActiveClip

**Type:** `string | undefined`

**Description:** Specifies an animation registered in the GLTF.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationActiveClip: "Walk"
  }
}
```

### animationAutoPlay

**Type:** `boolean | undefined`

**Description:** Specifies whether to auto-play the animation on initial load.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationAutoPlay: true
  }
}
```

### animationClips

**Type:** `string[] | undefined`

**Description:** Specifies a list of available animation clip names.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationClips: ["walk", "run", "jump"]
  }
}
```

### animationCrossfadeDuration

**Type:** `number | undefined`

**Description:** Specifies the crossfade duration in seconds when switching between animation clips.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationCrossfadeDuration: 0.5
  }
}
```

### animationEnabled

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable animation.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationEnabled: true
  }
}
```

### animationLoop

**Type:** `boolean | undefined`

**Description:** Specifies whether to loop the animation.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationLoop: true
  }
}
```

### animationSpeed

**Type:** `number | undefined`

**Description:** Specifies the animation playback speed. 1.0 is normal speed.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    animationSpeed: 1.0
  }
}
```

### applyWaterNormal

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply a water normal map.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    applyWaterNormal: true
  }
}
```

### castShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the model casts shadows. This works when shadows are enabled on the View and castShadow is enabled on the sunlight layer.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    castShadow: true
  }
}
```

### clampToGround

**Type:** `boolean | undefined`

**Description:** Specifies whether to clamp the model to the ground.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** Specifies the model color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  model: {
    color: new Color().setHex(0xffffff)
  }
}
```

### effectIds

**Type:** `string[] | undefined`

**Description:** Specifies the IDs of selective effects to apply (e.g., "bloom", "outline"). Used in conjunction with SelectiveBloomEffectLayer or SelectiveOutlineEffectLayer.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    effectIds: ["bloom", "outline"]
  }
}
```

### emissiveColor

**Type:** `Color | undefined`

**Description:** Specifies the emissive color as a `Color` instance.

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  model: {
    emissiveColor: new Color().setHex(0xff0000)
  }
}
```

### emissiveIntensity

**Type:** `number | undefined`

**Description:** Specifies the emissive intensity. The default value is 0.3 when the Bloom effect is enabled.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    emissiveIntensity: 0.5
  }
}
```

### height

**Type:** `number | undefined`

**Description:** Specifies the height of the model. The unit is meters.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    height: 50 // 50 meters
  }
}
```

### ior

**Type:** `number | undefined`

**Description:** Specifies the Index of Refraction. Affects the refraction of light passing through the material.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    ior: 1.5 // Index of refraction for glass
  }
}
```

### maxSse

**Type:** `number | undefined`

**Description:** The maximum value used to determine the level of detail (LOD). Higher values improve performance but reduce visual quality.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    maxSse: 16
  }
}
```

### metalness

**Type:** `number | undefined`

**Description:** Specifies the metalness of the material. Specified in the range of 0.0 to 1.0.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    metalness: 0.1
  }
}
```

### pointSize

**Type:** `number | undefined`

**Description:** Specifies the point size when rendering as a point cloud.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    pointSize: 2.0
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** Specifies whether the model receives shadows.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    receiveShadow: true
  }
}
```

### reflectivity

**Type:** `number | undefined`

**Description:** Specifies the reflectivity for post-processing or environment maps.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    reflectivity: 0.8
  }
}
```

### roughness

**Type:** `number | undefined`

**Description:** Specifies the roughness for post-processing. Specified in the range of 0.0 to 1.0.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    roughness: 0.1
  }
}
```

### selectiveEffectOcclusion

**Type:** `string | undefined`

**Description:** Specifies the depth behavior for the selective effect mask pass. Can be set to "normal" or "silhouette".

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    selectiveEffectOcclusion: "normal"
  }
}
```

### shininess

**Type:** `number | undefined`

**Description:** Specifies the shininess of the material.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    shininess: 30
  }
}
```

### shouldRotateInDefault

**Type:** `boolean | undefined`

**Description:** A property that automatically adjusts the model's orientation for correct placement on the ellipsoid.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    shouldRotateInDefault: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the model.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    show: true
  }
}
```

### showBoundingBox

**Type:** `boolean | undefined`

**Description:** Specifies whether to show the bounding box. Used for debugging purposes.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    showBoundingBox: true
  }
}
```

### size

**Type:** `number | undefined`

**Description:** Specifies the size of the model.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    size: 1.5 // 1.5x size
  }
}
```

### specular

**Type:** `boolean | undefined`

**Description:** Specifies whether to enable the specular effect. When enabled, the `shininess` and `specularStrength` values are used.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    specular: true
  }
}
```

### specularStrength

**Type:** `number | undefined`

**Description:** Specifies the intensity of specular highlights.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    specularStrength: 0.5
  }
}
```

### url

**Type:** `string | undefined`

**Description:** Specifies the data source URL.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    url: "https://example.com/models/building.glb"
  }
}
```

### water

**Type:** `boolean | undefined`

**Description:** Specifies whether to apply a water surface material to the polygon. May slow down mesh loading.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    water: true
  }
}
```

### waterNormalUrl

**Type:** `string | undefined`

**Description:** Specifies the URL of the water surface normal map.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterNormalUrl: "/textures/water_normal.png"
  }
}
```

### waterScaleNormal

**Type:** `number | undefined`

**Description:** Specifies the scale of the water surface normals. Smaller values make the water surface rougher.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterScaleNormal: 2.0
  }
}
```

### waterSpeed

**Type:** `number | undefined`

**Description:** Specifies the speed of water waves.

**Default:** `undefined`

**Example:**

```typescript
{
  model: {
    waterSpeed: 0.003
  }
}
```
