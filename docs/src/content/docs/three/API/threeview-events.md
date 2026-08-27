---
title: ThreeView Events
description: API Reference for ThreeView Class Events
sidebar:
  order: 920
---

This page describes all events available on a ThreeView instance.

## Methods

### on()

Registers event listeners for various view events.

```tsx
on<K extends keyof ViewEvents>(event: K, handler: ViewEvents[K]): void
```

### off()

Removes an event listener.

```tsx
off<K extends keyof ViewEvents>(event: K, handler: ViewEvents[K]): void
```

**Example:**

```tsx
const resizeHandler = (width, height) => {
  console.log(`Resized to ${width}x${height}`);
};

// Register event listener
view.on("resize", resizeHandler);

// Later, remove the listener
view.off("resize", resizeHandler);
```

### Advanced Example

```tsx
// Create named handlers for easy cleanup
const handlers = {
  handleClick: (event) => {
    console.log("Clicked:", event);
  },
  handleResize: (width, height) => {
    console.log(`Resized: ${width}x${height}`);
  },
  handlePick: (info) => {
    if (info) {
      console.log("Picked:", info.properties);
    }
  },
};

// Register multiple listeners
view.on("click", handlers.handleClick);
view.on("resize", handlers.handleResize);
view.on("featureClick", handlers.handlePick);

// Later, cleanup all listeners
view.off("click", handlers.handleClick);
view.off("resize", handlers.handleResize);
view.off("featureClick", handlers.handlePick);
```

## Event Types

### resize

**Description:**

Fires when the window is resized. Receives width and height in pixels.

**Handler Type:**

```tsx
(width: number, height: number) => void
```

**Parameters:**

- `width`: Width after resize (pixels)
- `height`: Height after resize (pixels)

**Example:**

```tsx
view.on("resize", (width, height) => {
  console.log(`Window resized: ${width}x${height}`);
});
```

### featureClick

**Description:**

Fires when a feature is clicked. Receives the clicked feature information, or `null` if empty space was clicked. For raw click coordinates, use the `click` event instead.

The click pick is lazy: the GPU pick runs only while at least one `featureClick` listener is registered.

:::note
To use this event, you must set `picking: true` in the ThreeView constructor (enabled by default).
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: Clicked feature information, or `null`

```tsx
type PickedFeature = {
  batchId: number; // Batch ID
  properties: Record<string, unknown> | undefined; // Feature properties
  layerId: string | undefined; // Layer ID
};
```

**Example:**

```tsx
view.on("featureClick", (info) => {
  if (info) {
    console.log("Selected feature:", info.properties);
    console.log("Layer ID:", info.layerId);
    console.log("Batch ID:", info.batchId);
  } else {
    console.log("No feature selected");
  }
});
```

### featureHover

**Description:**

Fires when the hovered feature changes as the pointer moves. Receives the newly hovered feature, or `null` when the pointer leaves all pickable features. The event fires only on change, not on every mouse move.

Hover picking runs a GPU pick per frame while the pointer moves, so it is activated lazily: picks run only while at least one `featureHover`, `featureEnter`, or `featureLeave` listener is registered, and are suppressed while a mouse button is pressed (for example, during a camera drag).

:::note
To use this event, you must set `picking: true` in the ThreeView constructor (enabled by default).
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: Hovered feature information, or `null`

**Example:**

```tsx
view.on("featureHover", (info) => {
  view.canvas.style.cursor = info ? "pointer" : "";
});
```

### featureEnter

**Description:**

Fires when the pointer starts hovering a pickable feature. Together with `featureLeave`, this is synthesized from the same hover picking as `featureHover`, so the same activation rules apply.

**Handler Type:**

```tsx
(info: PickedFeature) => void
```

**Parameters:**

- `info`: The feature the pointer started hovering

**Example:**

```tsx
view.on("featureEnter", (info) => {
  console.log("Entered feature:", info.properties);
});
```

### featureLeave

**Description:**

Fires when the pointer stops hovering the previously hovered feature. Receives the feature that was left. When the pointer moves directly from one feature to another, `featureLeave` fires for the previous feature before `featureEnter` fires for the new one.

**Handler Type:**

```tsx
(info: PickedFeature) => void
```

**Parameters:**

- `info`: The feature the pointer stopped hovering

**Example:**

```tsx
view.on("featureLeave", (info) => {
  console.log("Left feature:", info.properties);
});
```

### layer

**Description:**

Fires when a layer-related event occurs.

**Handler Type:**

```tsx
<K extends keyof LayerEvent>(
  k: K,
  layerId: string,
  ...args: Parameters<LayerEvent[K]>
) => void
```

**Example:**

```tsx
view.on("layer", (eventType, layerId, ...args) => {
  console.log(`Layer ${layerId} event: ${eventType}`, args);
});
```

### preUpdate

**Description:**

Fires before the update process. Receives a `DOMHighResTimeStamp` as a timestamp.

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp` (high-precision timestamp in milliseconds)

**Example:**

```tsx
view.on("preUpdate", (time) => {
  // Custom logic before update
  console.log(`Before update: ${time}ms`);
});
```

### postUpdate

**Description:**

Fires after the update process when state changes have occurred. Receives a `DOMHighResTimeStamp` as a timestamp.

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp` (high-precision timestamp in milliseconds)

**Example:**

```tsx
view.on("postUpdate", (time) => {
  // Custom logic after update
  console.log(`After update: ${time}ms`);
});
```

### preRender

**Description:**

Fires before rendering. When `animation: true`, fires every frame. Receives a `DOMHighResTimeStamp` as a timestamp.

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp` (high-precision timestamp in milliseconds)

**Example:**

```tsx
view.on("preRender", (time) => {
  // Custom logic before rendering
  console.log(`Before render: ${time}ms`);
});
```

### postRender

**Description:**

Fires after rendering. When `animation: true`, fires every frame. Receives a `DOMHighResTimeStamp` as a timestamp.

**Handler Type:**

```tsx
(time: number) => void
```

**Parameters:**

- `time`: `DOMHighResTimeStamp` (high-precision timestamp in milliseconds)

**Example:**

```tsx
view.on("postRender", (time) => {
  // Custom logic after rendering
  console.log(`After render: ${time}ms`);
});
```

### mousedown

**Description:**

Fires when a mouse button is pressed on the map. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("mousedown", (event) => {
  console.log(`Mouse down position: ${event.clientX}, ${event.clientY}`);
  console.log(
    `Map coordinates (ECEF): ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```

### mouseenter

**Description:**

Fires when the mouse enters the canvas area. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("mouseenter", (event) => {
  console.log("Mouse entered the map");
  console.log(`Map coordinates: ${event.map.x}, ${event.map.y}, ${event.map.z}`);
});
```

### mouseleave

**Description:**

Fires when the mouse leaves the canvas area. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("mouseleave", (event) => {
  console.log("Mouse left the map");
});
```

### mousemove

**Description:**

Fires when the mouse moves on the map. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("mousemove", (event) => {
  console.log(`Mouse position: ${event.clientX}, ${event.clientY}`);
  console.log(
    `Map coordinates (ECEF): ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```

### mouseup

**Description:**

Fires when a mouse button is released on the map. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("mouseup", (event) => {
  console.log(`Mouse up position: ${event.clientX}, ${event.clientY}`);
  console.log(`Map coordinates: ${event.map.x}, ${event.map.y}, ${event.map.z}`);
});
```

### idle

**Description:**

Fires when data and tile processing becomes idle, that is, when no updates such as tile loading or data processing have occurred for at least `idleThreshold` milliseconds. Continuous animations and effects do not count as activity, so this event fires even while they are running. It fires at most once per idle period and resets when processing activity resumes.

**Handler Type:**

```tsx
() => void
```

**Example:**

```tsx
view.on("idle", () => {
  console.log("Data and tile processing is idle");
});
```

:::tip
Use the `idleThreshold` constructor option to control how long the engine must be inactive before the event fires. The default is 100 ms.
:::

### click

**Description:**

Fires when the map is clicked. Receives a `MapMouseEvent` containing map coordinates.

**Handler Type:**

```tsx
(event: MapMouseEvent) => void
```

**Parameters:**

- `event`: Mouse event (containing map coordinates)

**Example:**

```tsx
view.on("click", (event) => {
  console.log(`Click position: ${event.clientX}, ${event.clientY}`);
  console.log(
    `Map coordinates (ECEF): ${event.map.x}, ${event.map.y}, ${event.map.z}`
  );
});
```
