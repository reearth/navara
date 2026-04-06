---
title: ThreeView Properties
description: API Reference for ThreeView Class Properties and Events
sidebar:
  order: 14
---

This page describes all properties and events available on a ThreeView instance.

## Properties

### camera

**Type:** `ThreeViewCamera`

The camera controller that manages the view's position, orientation, and projection. Access the Three.js `PerspectiveCamera` via the `raw` property.

**Example:**

```tsx
// Get the Three.js camera position
const position = view.camera.raw.position;

// Change the camera field of view
view.camera.raw.fov = 60;
view.camera.raw.updateProjectionMatrix();
```

### renderer

**Type:** `WebGLRenderer`

The Three.js WebGLRenderer instance used for rendering the scene.

**Example:**

```tsx
// Change the clear color
view.renderer.setClearColor(0x000000);

// Get renderer information
console.log(view.renderer.info.render);
```

### globe

**Type:** `Globe`

The Globe instance that manages terrain, imagery layers, and globe-specific settings. Controls various properties related to globe display, including transparency, wireframe display, and elevation heatmap color maps.

**Example:**

```tsx
// Set globe transparency
view.globe.transparent = true;
view.globe.opacity = 0.8;

// Enable wireframe mode
view.globe.wireframe = true;

// Set color map for elevation heatmap
view.globe.elevationColormap = customColorMap;
```

:::tip[Related Documentation]
For details, see [Globe Class](../../../three/api-reference/globe/).
:::

### atmosphere

**Type:** `Atmosphere`

The instance that manages the atmosphere system. Handles sun and moon position calculations and atmospheric scattering texture management. When the `date` property is changed, sun and moon directions are automatically recalculated based on the ephemeris and reflected in related layers such as `SunLightLayer` and `SkyMeshLayer`.

**Example:**

```tsx
// Set the date to change the sun position
view.atmosphere.setDate(new Date("2024-06-21T12:00:00"));

// Get the sun direction vector
const sunDirection = view.atmosphere.getSunDirection();

// Determine if the current location is at night
const isNight = view.atmosphere.isAtNight(view.camera.position);

// Monitor sun direction changes
view.atmosphere.on("sunChanged", (sunDirection) => {
  console.log("Sun direction changed:", sunDirection);
});
```

:::tip[Related Documentation]
For details, see [Atmosphere Class](../../../three/api-reference/atmosphere/).
:::

### toneMappingExposure

**Type:** `number`

Gets or sets the tone mapping exposure value for HDR rendering. Higher values make the scene brighter, lower values make it darker.

**Example:**

```tsx
// Increase exposure for a brighter scene
view.toneMappingExposure = 1.5;

// Decrease exposure for a darker scene
view.toneMappingExposure = 0.8;
```

### globeDepthTexture

**Type:** `Texture`

Gets the globe depth texture for post-processing effects. Can be used in custom shaders and effects.

**Read-only**

**Example:**

```tsx
// Use the depth texture in a custom shader
customMaterial.uniforms.depthMap.value = view.globeDepthTexture;
```

### globeNormalTexture

**Type:** `Texture`

Gets the globe normal texture for post-processing effects. Can be used in custom shaders and effects.

**Read-only**

**Example:**

```tsx
// Use the normal texture in a custom shader
customMaterial.uniforms.normalMap.value = view.globeNormalTexture;
```

### animation

**Type:** `boolean`

Gets or sets whether continuous animation mode is enabled. When `true`, renders every frame; when `false`, renders only on changes.

**Example:**

```tsx
// Enable continuous rendering
view.animation = true;

// Render only when needed (power saving)
view.animation = false;
```

### screenSize

**Type:** `Vector2`

Gets the current screen size in pixels.

**Read-only**

**Example:**

```tsx
const size = view.screenSize;
console.log(`Screen size: ${size.x} x ${size.y} pixels`);
```

### pixelRatio

**Type:** `number`

Gets the current device pixel ratio.

**Read-only**

**Example:**

```tsx
const ratio = view.pixelRatio;
console.log(`Pixel ratio: ${ratio}`);
```

### normalTexture

**Type:** `Texture`

Gets the scene normal texture from the G-buffer. Generated in the MRT (Multiple Render Targets) pass and can be used in post-processing effects and custom shaders.

**Read-only**

**Example:**

```tsx
// Use the normal texture in a custom shader
customMaterial.uniforms.sceneNormal.value = view.normalTexture;
```

### shadowMapViewersEnabled

**Type:** `boolean`

Gets or sets whether the shadow map debug viewers are displayed on screen.

**Example:**

```tsx
// Show shadow map debug views
view.shadowMapViewersEnabled = true;

// Hide debug views
view.shadowMapViewersEnabled = false;
```
