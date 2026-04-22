---
title: ThreeView Events
description: API Reference for ThreeView Class Events
sidebar:
  order: 12
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
view.on("pick", handlers.handlePick);

// Later, cleanup all listeners
view.off("click", handlers.handleClick);
view.off("resize", handlers.handleResize);
view.off("pick", handlers.handlePick);
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

### pick

**Description:**

Fires when a feature is picked (selected). Receives the picked feature information, or `null` if nothing is selected.

:::note
To use this event, you must set `picking: true` in the ThreeView constructor.
:::

**Handler Type:**

```tsx
(info: PickedFeature | null) => void
```

**Parameters:**

- `info`: Picked feature information, or `null`

```tsx
type PickedFeature = {
  batchId: number; // Batch ID
  properties: Record<string, unknown> | undefined; // Feature properties
  layerId: string | undefined; // Layer ID
};
```

**Example:**

```tsx
view.on("pick", (info) => {
  if (info) {
    console.log("Selected feature:", info.properties);
    console.log("Layer ID:", info.layerId);
    console.log("Batch ID:", info.batchId);
  } else {
    console.log("No feature selected");
  }
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
