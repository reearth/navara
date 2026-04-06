---
title: What is navara_three_api?
description: Overview and features of navara_three_api.
sidebar:
  order: 2
---

## What is navara_three_api?

`navara_three_api` is a utility library that provides GIS-specific computational functions as individual APIs. It is integrated with Three.js's type system, making it easy to connect computational processing needed for geospatial application development with the rendering engine.

:::tip[Recommended]
If you are using `@navara/three`, the navara_three_api functions can be imported directly from `@navara/three`. No separate installation is required.
:::

## Provided Features

Below are representative features provided by navara_three_api. For details on all functions and classes, see the [API Reference](../../../three/api-reference/navara_three_api/).

### Coordinate Transformation

You can convert between latitude/longitude (geodetic coordinates) and Three.js world coordinates (ECEF).

```typescript
import { geodeticToVector3, degreeToRadian } from "@navara/three";

// Convert Tokyo coordinates to a Three.js Vector3
const position = geodeticToVector3({
  lat: degreeToRadian(35.6762),
  lng: degreeToRadian(139.6503),
  height: 100,
});
```

### Screen-to-World Coordinate Conversion

You can obtain geographic coordinates on the map from a mouse click position, or calculate on-screen pixel positions from geographic coordinates. This enables implementation of interactive map operations and label placement.

```typescript
import { convertScreenToWorld } from "@navara/three";
import { Vector2 } from "three";

// Get map coordinates from a click position
const screenPos = new Vector2(event.clientX, event.clientY);
const worldPos = convertScreenToWorld(windowObject, camera, screenPos);
```

### Local Coordinate System Transformation

You can set up a local coordinate system (such as East-North-Up) with a specific point on the Earth as the origin. You can obtain the transformation matrix needed to correctly place 3D models on the ground surface.

```typescript
import { eastNorthUpToFixedFrame, geodeticToVector3 } from "@navara/three";

// Get the ENU coordinate system transformation matrix with Tokyo as the origin
const origin = geodeticToVector3(tokyoLle);
const enuMatrix = eastNorthUpToFixedFrame(origin);

// Apply to a mesh to correctly place it on the ground surface
mesh.matrix.copy(enuMatrix);
```

### Geodesic Calculations

You can calculate the distance and azimuth along the Earth's surface between two points. This can be used for route display and area calculations.

```typescript
import { EllipsoidGeodesic, degreeToRadian } from "@navara/three";

const geodesic = new EllipsoidGeodesic(tokyo, osaka);
console.log(`Distance: ${geodesic.distance / 1000} km`);
console.log(`Azimuth: ${geodesic.startHeading} rad`);
```

## Relationship with navara_three

navara_three_api can be used independently from navara_three, but it is typically used in combination with navara_three. navara_three handles layer-based declarative map construction, while navara_three_api supports coordinate calculations and interaction processing.
