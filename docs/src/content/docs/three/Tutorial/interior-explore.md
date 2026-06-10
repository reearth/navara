---
title: Interior Explore
description: How to explore the interior of 3D buildings with the PersonViewPlugin
sidebar:
  order: 8
---

![Result](@assets/tutorial/model-animation.png)

Learn how to explore the interior of 3D Tiles buildings while controlling a character with [PersonViewPlugin](../../../three_plugins/personviewplugin/) from `@navara/three_plugins`. The plugin lets you wire up character controls with minimal code.

**What you will learn in this tutorial:**
- Loading 3D Tiles building models
- Driving a GLTF character with `PersonViewPlugin`
- Letting the character move underground and through buildings
- Switching between third-person and first-person view
- Teleporting the character when the scene changes

## Setting Up the Basic Scene

First, build a scene for building exploration. Create a `ThreeView` with shadow and background color settings.

```typescript
import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { PersonViewPlugin } from "@navara/three_plugins";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});
view.addPlugin(plugin);
```

We will register the `PersonViewPlugin` next, before calling `view.init()`.

## Adding the PersonViewPlugin

The plugin handles the character (model, animation, movement) and the camera. Set `minAlt` to a negative value so the character can walk below ground level, and choose a tight `cameraDistance` / `cameraHeight` that works inside a building.

```typescript
const startLat = 35.6669;
const startLng = 139.7490;
const startHeight = 38;

const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/Soldier/Soldier.glb",
    animation: {
      idleClip: "Idle",
      walkClip: "Walk",
      dashClip: "Run",
      speed: 1.0,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: Math.PI / 2, y: 0, z: 0 },
    modelScale: 1,
  },
  moveSpeed: 5,
  altSpeed: 5,
  rotationSpeed: 4,
  cameraDistance: 10,
  cameraHeight: 1,
  cameraLerpSpeed: 4,
  minAlt: -1000,
  maxAlt: 5000,
  startLat,
  startLng,
  startHeight,
  allowCameraControl: true,
});

view.addPlugin(personView);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

const layers = plugin.addDefaultPhotorealScene();
layers.sun.update({ sun: { castShadow: true } });
```

:::note[Preparing Model Data]
This tutorial uses `Soldier.glb` from the official Three.js samples. Download it from the [Three.js GitHub repository](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/Soldier.glb) and place it under `public/glTF/Soldier/`. Any animated GLTF model works — just match `idleClip` and `dashClip` to the clip names your model exposes.
:::

## Adding Terrain and Map Tiles

Add terrain and satellite imagery tiles for the exploration area. Turn off the terrain skirt so the underground portion of buildings stays visible.

```typescript
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false,
  },
});

view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});
```

## Loading 3D Tiles Building Models

Load a Cesium 3D Tiles building such as those published by PLATEAU and enable shadows so the interior reads as a real space.

```typescript
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35, // Ellipsoidal height adjustment
  },
});
```

:::note[About Ellipsoidal Height Adjustment]
3D Tiles models may be placed based on ellipsoidal height (WGS84). In Japan, there is a difference between ellipsoidal height and geoid height, so adjustment using the `height` property may be necessary.
:::

## Starting the Plugin

Once the scene is configured, start the plugin. This loads the GLTF model and begins the per-frame loop that drives the character and camera.

```typescript
personView.start();
```

That's it — the character now responds to the keyboard and the camera follows it.

**Default key bindings**

| Key              | Action                             |
| ---------------- | ---------------------------------- |
| W / S            | Move forward / backward            |
| A / D            | Turn left / right                  |
| Arrow Up / Space | Ascend                             |
| Arrow Down / Ctrl| Descend                            |
| Shift            | Dash (switches to `dashClip`)      |
| Alt (hold)       | Free-orbit camera                  |
| V                | Toggle third-person / first-person |

The default chase view (TPV) is third person. Press **V** to switch to first person (FPV); the character mesh is hidden automatically. Hold **Alt** to take manual control of the camera while keeping it focused on the character.

## Reacting to Movement

The plugin emits the current geographic position, heading, speed, and view mode on every frame. Use `onStateChange()` to drive UI such as a HUD or a minimap.

```typescript
const unsubscribe = personView.onStateChange((state) => {
  console.log(state.lat, state.lng, state.alt, state.heading, state.mode);
});

// Later — when you are done
unsubscribe();
```

## Teleporting Between Scenes

Use `teleport(lng, lat, alt, heading?)` to jump the character to a new place — for example when the user picks a different building from a menu.

```typescript
personView.teleport(139.7397, 35.6352, 45);
```

The chase camera snaps to the new location and the state listener fires once with the updated position.

## Complete Example

A complete example that combines the plugin with a 3D Tiles building. The code is intentionally short: the plugin owns the input, character, animation, and camera.

```typescript
import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { PersonViewPlugin } from "@navara/three_plugins";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  backgroundColor: new Color().setStyle("#475668"),
});

const startLat = 35.6669;
const startLng = 139.7490;
const startHeight = 38;

const personView = new PersonViewPlugin({
  character: {
    modelUrl: "/glTF/Soldier/Soldier.glb",
    animation: {
      idleClip: "Idle",
      walkClip: "Walk",
      dashClip: "Run",
      speed: 1.0,
      crossfadeDuration: 0.3,
    },
    modelRotationOffset: { x: Math.PI / 2, y: 0, z: 0 },
    modelScale: 1,
  },
  moveSpeed: 5,
  altSpeed: 5,
  rotationSpeed: 4,
  cameraDistance: 10,
  cameraHeight: 1,
  cameraLerpSpeed: 4,
  minAlt: -1000,
  maxAlt: 5000,
  startLat,
  startLng,
  startHeight,
  allowCameraControl: true,
});

view.addPlugin(plugin);
view.addPlugin(personView);
await view.init();

view.atmosphere.date.setHours(8);
view.toneMappingExposure = 10;

const layers = plugin.addDefaultPhotorealScene();
layers.sun.update({ sun: { castShadow: true } });

view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
    skirt: false,
  },
});

view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 18 },
});

view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - [UC23-11] Advanced Area Management Using Storytelling GIS - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-uc23-11
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
  },
  model: {
    show: true,
    castShadow: true,
    receiveShadow: true,
    height: -35,
  },
});

personView.start();
```

:::tip[Customization Tips]
- **Explore a different building**: Change the `cesium3dtiles` layer URL to load a different PLATEAU model and call `personView.teleport()` to drop the character at the new location
- **Adjust movement feel**: Tweak `moveSpeed`, `rotationSpeed`, and `altSpeed` on the plugin config
- **Use your own model**: Pass a different `character.modelUrl` and update `idleClip` / `dashClip` to match the clips it ships with
- **Lock camera to chase mode**: The example sets `allowCameraControl: true` so the camera always orbits freely. Set it to `false` to require holding **Alt** for manual orbit while the chase shot follows automatically the rest of the time
- **First-person at startup**: Pass `initialView: "fpv"` to start in first person
- **Custom key bindings**: Use the `keys` option to remap any action (for example, `keys: { ascend: ["Space"], descend: ["ControlLeft"] }`)
:::
