# @navara/three_react

React bindings for Navara Three. It provides a small set of components and hooks to use `@navara/three` declaratively from React apps.

## Install

```bash
pnpm add @navara/three @navara/three_react react react-dom three
```

## Quick Start

Wrap your app with `ViewProvider`, then add layers with the `Layer` component.

```tsx
// App.tsx
import { ViewProvider } from "@navara/three_react";
import { Layers } from "./Layers";

export default function App() {
  return (
    <ViewProvider>
      <Layers />
    </ViewProvider>
  );
}
```

```tsx
// Layers.tsx
import {
  JAPAN_GSI_ELEVATION_DECODER,
  type LayerDescription,
  type TilesLayer,
  Layer as NavaraLayer,
} from "@navara/three";
import { useViewContext, useDefaultLayers, Layer } from "@navara/three_react";
import { useMemo, useState } from "react";

export function Layers() {
  const { view } = useViewContext();

  // mount atmosphere/effects once
  useDefaultLayers(view);

  const baseTiles = useMemo<LayerDescription>(
    () => ({
      type: "tiles",
      data: { url: "…" },
      raster_tile: { min_zoom: 2, max_zoom: 18 },
    }),
    [],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      data: { url: "…" },
      raster_terrain: {
        min_zoom: 6,
        max_zoom: 15,
        elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
        cast_shadow: true,
        receive_shadow: true,
      },
    }),
    [],
  );

  return (
    <>
      <Layer config={baseTiles} />
      <Layer config={terrain} />
    </>
  );
}
```

## API

- `ViewProvider`
  - Props: `{ canvas?: HTMLCanvasElement | RefObject<HTMLCanvasElement> }`.
  - Creates a `ThreeView` and provides it via context. If no `canvas` is given, a fullscreen canvas is appended to `document.body`.

- `useViewContext<CustomLayerDescriptions>()`
  - Returns `{ view }` where `view` is the underlying `ThreeView<CustomLayerDescriptions>`.
  - Must be used inside `ViewProvider`.

- `Layer`
  - Props: `{ config: LayerDescription; onReady?: (handle) => void }`.
  - Declaratively adds a layer on mount and updates it when `config` changes. The `onReady` callback receives a layer handle.

- `useDefaultLayers(view)`
  - Mounts default effect and atmosphere layers once when a `view` becomes available.

## Canvas control (optional)

If you want to host the canvas inside your own layout, pass a ref to `ViewProvider`:

```tsx
import { useRef } from "react";
import { ViewProvider } from "@navara/three_react";

export function AppWithCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <ViewProvider canvas={canvasRef}>
        <Layers />
      </ViewProvider>
    </div>
  );
}
```

## Notes

- This package is client-side only; if using SSR, render these components on the client.
- Types are included.

## License

MIT OR Apache-2.0
