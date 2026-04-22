---
title: Getting Started
description: Quick start guide to create your first Navara 3D globe application.
sidebar:
  order: 3
---

## Quick Start

This page walks you through the minimal code needed to display a 3D globe with Navara. By the end, you will have a working map with raster tiles and a positioned camera.

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

Here is the core code that creates a 3D globe, adds a raster tile layer, and sets the camera:

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// Create the view
const view = new ThreeView({
  animation: true,
  shadow: true,
});

// Register the default plugin with built-in descriptors
const plugin = new DefaultPlugin();
view.addPlugin(plugin);

// Initialize the engine
await view.init();

// Add a raster tile layer using OpenStreetMap
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 18,
  },
});

// Position the camera over Tokyo
view.setCamera({
  lng: 139.77,
  lat: 35.68,
  height: 10000,
  heading: 0,
  pitch: -30,
  roll: 0,
});
```

## What This Code Does

The `ThreeView` class is the main entry point for Navara. Creating an instance sets up the Three.js renderer, scene graph, and rendering pipeline. The `animation: true` option enables continuous rendering, and `shadow: true` enables shadow mapping.

Before calling `init()`, you register plugins. The `DefaultPlugin` registers over 30 descriptor types — sky, atmosphere, lighting, terrain, and post-processing effects — so they are available for use after initialization. You can also create and register your own plugins for custom descriptor types.

The `init()` call initializes the WASM GIS engine, sets up Web Workers for background processing, and prepares the rendering pipeline. This is an asynchronous operation that must complete before you add layers.

After initialization, `addLayer()` creates a new layer on the globe. In this example, we add a raster tile layer that loads OpenStreetMap tiles. Navara's GIS engine handles tile management, level-of-detail, and spatial indexing automatically.

Finally, `setCamera()` positions the camera at a geographic coordinate with a given height, heading, and pitch. The camera immediately moves to this position. For animated transitions, you can use `flyTo()` instead.

## Next Steps

This example only scratches the surface. To learn how to add terrain elevation, display GeoJSON data, and compose multiple layers, continue with the [Basic Visualization Tutorial](../../../three/Tutorial/basic-visualization/).
