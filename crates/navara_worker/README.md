# Navara Worker Plugin

This is a plugin for a worker. This plugin abstracts a worker for several platform.

## How it works

There are two type of process.

1. A process for native app that Bevy can handle systems parallely.
2. A process for WASM app that Bevy can **NOT** handle systems parallely.

These process is switched by Rust features like below.

```
// For native app
#[cfg(not(feature = "delegated_worker"))]
fn handle_heavy_task(tasks: Query<&HeavyTask>) {}

// For WASM app
#[cfg(feature = "delegated_worker")]
fn handle_heavy_task(tasks: Query<&HeavyTask>) {}
```
