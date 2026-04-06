---
title: Libraries
description: A guide in my new Starlight docs site.
sidebar:
  order: 3
---

## navara_three

- A JavaScript library that connects `navara_wasm` and Three.js
- Renders terrain, features, points, etc. through the `ThreeView` class
- Asynchronously manages WASM initialization, data loading, and scene reflection
- Enables flexible control of map rendering from JS applications
- For details, see the [navara_three](../../../three/introduction/what-is-navara-three/) page

## navara_wasm

- A WASM module built from the Rust-based GIS engine
- Enables fast and safe GIS processing in web browsers
- Handles coordinate transformation, LOD control, spatial indexing, tile management, etc.
- Organizes and executes processing in plugin units using Bevy ECS
- For details, see the [navara_wasm](../../../wasm/introduction/what-is-navara-wasm/) page

## navara_three_api

- A JavaScript library that connects `navara_wasm_api` and Three.js
- Enables independent execution of GIS processing such as coordinate transformation
- Enables advanced coordination between the rendering engine and GIS computation
- For details, see the [navara_three_api](../../../three/introduction/what-is-navara-three-api/) page

## navara_wasm_api

- A WASM module that exposes Rust-based GIS processing modules as independent APIs
- Enables fast and safe GIS processing in web browsers
- Enables independent execution of coordinate transformation, ellipsoidal geometry calculations, etc.
- For details, see the [navara_wasm_api](../../../wasm/introduction/what-is-navara-wasm-api/) page
