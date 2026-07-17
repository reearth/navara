---
title: Getting Started
description: Quick start guide to create your first Navara 3D globe application.
sidebar:
  order: 3
---

## Quick Start

This page walks you through the minimal code needed to display a 3D globe with Navara. By the end, you will have a working globe with satellite imagery and a photorealistic sky and atmosphere.

## Prerequisites

You need [Node.js](https://nodejs.org/) (v18 or later) and a package manager such as npm or pnpm installed on your machine.

## Create a Project

The fastest way to get started is with the starter template:

```bash
npm create navara-three-starter my-navara-app
cd my-navara-app
npm install
npm run dev
```

This scaffolds a minimal project with Navara and its dependencies pre-configured.

## Minimal Example

Here is the core code — the same example shown in [What is Navara?](../what-is-navara/) — that creates a 3D globe, displays satellite imagery, and enables the photorealistic sky and atmosphere:

![Hero](@assets/hero.png)

```typescript
import ThreeView from "@navaramap/three";
import { DefaultPlugin } from "@navaramap/three_default_plugin";

const view = new ThreeView({ useNormal: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

// Initialization

await view.init();

// Setup scene
defaultPlugin.addDefaultPhotorealScene();
view.atmosphere.date = new Date("2026-07-16T01:00:00Z");
view.toneMappingExposure = 10;

// Layer declaration

const raster = view.addSource({
  type: "raster-tile",
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  maxZoom: 8,
});

view.addLayer({
  type: "raster",
  source: raster,
  raster: {},
});

// Attribution

view.attribution?.add([{ attributionHtml: `Imagery courtesy of <a href="https://earthdata.nasa.gov/gibs">NASA EOSDIS GIBS</a> · Blue Marble: Next Generation (public domain)` }]);
```

## What This Code Does

The `ThreeView` class is the main entry point for Navara. Creating an instance sets up the Three.js renderer, scene graph, and rendering pipeline. The `useNormal: true` option enables surface normals on the globe, which the sunlight added later uses for lighting calculations. It is needed when the scene has no terrain or hillshade layer — those provide normals themselves.

Before calling `init()`, you register plugins. The `DefaultPlugin` registers over 30 descriptor types — sky, atmosphere, lighting, terrain, and post-processing effects — so they are available for use after initialization. You can also create and register your own plugins for custom descriptor types.

The `init()` call initializes the WASM GIS engine, sets up Web Workers for background processing, and prepares the rendering pipeline. This is an asynchronous operation that must complete before you add layers.

After initialization, `addDefaultPhotorealScene()` adds the sky, stars, sunlight, and atmospheric effects in one call. Setting `view.atmosphere.date` determines the sun's position — use a UTC string (`"...Z"`) so the scene looks the same on every machine — and `toneMappingExposure` adjusts the overall brightness of the tone-mapped output.

`addSource()` registers where and how data is fetched, and `addLayer()` renders it on the globe. In this example, a raster tile source loads NASA's Blue Marble satellite imagery. Navara's GIS engine handles tile management, level-of-detail, and spatial indexing automatically.

Finally, `view.attribution` is the built-in attribution UI; `add()` displays credits for the data sources you use.

This example keeps the default camera, which shows the whole globe. To move somewhere specific, use `setCamera()` for an instant jump or `flyTo()` for an animated transition.

## Next Steps

This example only scratches the surface. To learn how to add terrain elevation, display GeoJSON data, and compose multiple layers, continue with the [Basic Visualization Tutorial](../../../three/tutorial/basic-visualization/).
