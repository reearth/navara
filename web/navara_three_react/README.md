# @navaramap/three-react

React bindings for Navara Three. It provides a small set of components and hooks to use `@navaramap/three` declaratively from React apps.

## Install

```bash
pnpm add @navaramap/three @navaramap/three-react react react-dom three
```

## Quick Start

Wrap your app with `ViewProvider`, then add layers with the `Layer` component.

```tsx
// App.tsx
import { ViewProvider } from "@navaramap/three-react";
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
} from "@navaramap/three";
import { useViewContext, Layer } from "@navaramap/three-react";
import { useEffect, useMemo } from "react";

export function Layers() {
  const { view } = useViewContext();

  // Credit the data through the built-in attribution UI.
  useEffect(() => {
    view?.attribution?.add([
      {
        attribution: "Geospatial Information Authority of Japan (GSI)",
        attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
      },
    ]);
  }, [view]);

  const baseTilesSource = useMemo(
    () =>
      view.addSource({
        type: "raster-tile",
        url: "…",
        minZoom: 2,
        maxZoom: 18,
      }),
    [view],
  );
  const demSource = useMemo(
    () =>
      view.addSource({
        type: "raster-dem",
        url: "…",
        elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
        minZoom: 6,
        maxZoom: 15,
      }),
    [view],
  );

  const baseTiles = useMemo<LayerDescription>(
    () => ({ type: "raster", source: baseTilesSource }),
    [baseTilesSource],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      source: demSource,
      terrain: { castShadow: true, receiveShadow: true },
    }),
    [demSource],
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

## Canvas control (optional)

If you want to host the canvas inside your own layout, pass a ref to `ViewProvider`:

```tsx
import { useRef } from "react";
import { ViewProvider } from "@navaramap/three-react";

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
