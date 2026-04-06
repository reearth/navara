---
title: What is navara_wasm?
description: A guide in my new Starlight docs site.
sidebar:
  order: 1
---

## What is navara_wasm?

navara_wasm is a module that compiles a Rust-based GIS engine into WebAssembly (WASM), enabling it to run in web browsers. It performs high-speed map processing while communicating asynchronously with the rendering engine.

## Key Roles

- Serves as the entry point for running the Rust-based GIS engine in the browser
- Manages asynchronous communication with rendering engines (e.g., navara_three)
- Internally executes GIS processing such as LOD, coordinate transformation, and tile management
- Manages and updates internal state using Bevy ECS

## Characteristics

- Rust-based engine

  - Achieves robust implementation through type safety
  - Optimized through low-level memory management

- Efficient integration with rendering engines

  - Receives commands from navara_three and others via event-driven architecture, processing state updates and feature additions asynchronously
  - Delegates heavy processing to Web Workers to reduce main thread load

- Efficient state management via ECS

  - Uses Bevy ECS to flexibly control entities (features, cameras, terrain, etc.)
  - Enables automatic control of LOD and visible range based on GIS data

- Rendering engine-agnostic architecture

  - Independent of specific rendering engines (Three.js, Babylon.js, etc.), providing high versatility
  - GIS engine API can be used independently

- Multi-platform support
  - Architecture enables future deployment beyond the web (native apps, mobile, etc.)

## Typical Usage

It is executed internally through rendering engine libraries such as navara_three.
