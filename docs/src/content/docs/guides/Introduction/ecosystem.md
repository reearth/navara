---
title: Ecosystem
description: A guide in my new Starlight docs site.
sidebar:
  order: 2
---

## navara Ecosystem Overview

- Navara separates the GIS engine (map logic) from the rendering engine (drawing), enabling the following:

  - Diverse visual expressions
  - Processing optimized for the rendering engine
  - Flexible integration with multiple drawing libraries
  - Highly reusable architecture independent of any specific platform

## Structure

![architecture](@assets/architecture.png)

### GIS Engine

- navara_wasm

  - Manages communication between JS and Rust (data conversion, asynchronous communication, etc.)

- navara_ecs (main loop)

  - Updates the world state (entities, camera, tiles, etc.)
  - Issues per-frame updates, input event processing, and draw commands

- GIS Processing Modules
  - Performs coordinate transformation, feature geometry computation, style application, etc.

### Rendering Engine

- Libraries (navara_three, etc.)

  - Relays operations from the UI to the WASM layer
  - Serves as the interface for handling state retrieval, layer addition, etc. from JavaScript

- API Libraries (navara_three_api, etc.)

  - Exposes GIS processing modules as independent APIs
  - Independently executes complex GIS-specific operations such as coordinate transformation and ellipsoidal geometry calculations

- Rendering Engine (Three.js, etc.)
  - Works with the GPU to render maps and 3D objects
