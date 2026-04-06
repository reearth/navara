---
title: navara_wasm_api
description: navara_wasm API reference for utility functions
sidebar:
  order: 4
---

navara_wasm_api is an API that provides utility functions for geospatial calculations, coordinate transformations, intersection tests, and more. This API is designed to make it easy to perform the mathematical calculations needed in 3D geospatial applications.

## Ellipsoid Functions

A set of functions for retrieving the basic parameters of the WGS84 ellipsoid.

### getWGS84SemiMajorAxis()

Retrieves the semi-major axis of the WGS84 ellipsoid.

```typescript
getWGS84SemiMajorAxis(): number
```

**Returns:**

The semi-major axis of the WGS84 ellipsoid (in meters)

**Example:**

```typescript
const semiMajorAxis = getWGS84SemiMajorAxis();
console.log(`Semi-major axis: ${semiMajorAxis} m`); // Semi-major axis: 6378137 m
```

### getWGS84SemiMinorAxis()

Retrieves the semi-minor axis of the WGS84 ellipsoid.

```typescript
getWGS84SemiMinorAxis(): number
```

**Returns:**

The semi-minor axis of the WGS84 ellipsoid (in meters)

**Example:**

```typescript
const semiMinorAxis = getWGS84SemiMinorAxis();
console.log(`Semi-minor axis: ${semiMinorAxis} m`); // Semi-minor axis: 6356752.314245 m
```

### getWGS84EccentricitySquared()

Retrieves the square of the eccentricity of the WGS84 ellipsoid.

```typescript
getWGS84EccentricitySquared(): number
```

**Returns:**

The square of the eccentricity of the WGS84 ellipsoid

### getWGS84Flattening()

Retrieves the flattening of the WGS84 ellipsoid.

```typescript
getWGS84Flattening(): number
```

**Returns:**

The flattening of the WGS84 ellipsoid

### getWGS84Eccentricity()

Retrieves the eccentricity of the WGS84 ellipsoid.

```typescript
getWGS84Eccentricity(): number
```

**Returns:**

The eccentricity of the WGS84 ellipsoid

## Coordinate Transformation

A set of functions for converting between coordinate systems.

### geodeticToXyz(lle: LLE)

Converts geodetic coordinates (latitude, longitude, height) to the ECEF coordinate system (Earth-Centered, Earth-Fixed).

```typescript
geodeticToXyz(lle: LLE): Vec3
```

**Parameters:**

- `lle`: The geodetic coordinates to convert
  - `lat`: Latitude (in radians)
  - `lng`: Longitude (in radians)
  - `height`: Height (in meters)

**Returns:**

Position in the ECEF coordinate system [x, y, z]

**Example:**

```typescript
const lle = { lat: 0.6283, lng: 2.4435, height: 100 }; // Near Tokyo
const ecef = geodeticToXyz(lle);
console.log(`ECEF coordinates: [${ecef.x}, ${ecef.y}, ${ecef.z}]`);
```

### xyzToGeodetic(vec3: Vec3)

Converts ECEF coordinates to geodetic coordinates (latitude, longitude, height).

```typescript
xyzToGeodetic(vec3: Vec3): LLE
```

**Parameters:**

- `vec3`: The ECEF coordinates to convert [x, y, z]

**Returns:**

Geodetic coordinates:
- `lat`: Latitude (in radians)
- `lng`: Longitude (in radians)
- `height`: Height (in meters)

**Example:**

```typescript
const ecef = { x: -3946416, y: 3364068, z: 3702654 }; // ECEF coordinates near Tokyo
const lle = xyzToGeodetic(ecef);
console.log(`Latitude: ${lle.lat}, Longitude: ${lle.lng}, Height: ${lle.height}`);
```

### angleToRadian(degree: number)

Converts an angle from degrees to radians.

```typescript
angleToRadian(degree: number): number
```

**Parameters:**

- `degree`: The angle in degrees

**Returns:**

The angle in radians

**Example:**

```typescript
const radians = angleToRadian(90);
console.log(`90 degrees = ${radians} radians`); // 90 degrees = 1.5708 radians
```

### angleToDegree(radian: number)

Converts an angle from radians to degrees.

```typescript
angleToDegree(radian: number): number
```

**Parameters:**

- `radian`: The angle in radians

**Returns:**

The angle in degrees

**Example:**

```typescript
const degrees = angleToDegree(Math.PI);
console.log(`π radians = ${degrees} degrees`); // π radians = 180 degrees
```

## Screen-World Projection

A set of functions for converting between screen coordinates and world coordinates.

### screenToWorld(window, transform, frustum, screen_pos)

Converts screen coordinates to world coordinates.

```typescript
screenToWorld(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  screen_pos: Vec2
): Vec3 | null
```

**Parameters:**

- `window`: Window information
- `transform`: Camera transform matrix
- `frustum`: Camera frustum
- `screen_pos`: Screen coordinates [x, y]

**Returns:**

The position in world coordinates, or null if there is no intersection

**Example:**

```typescript
const worldPos = screenToWorld(window, cameraTransform, frustum, {
  x: 400,
  y: 300,
});
if (worldPos) {
  console.log(`World coordinates: [${worldPos.x}, ${worldPos.y}, ${worldPos.z}]`);
}
```

### worldToScreen(window, transform, frustum, world_pos)

Converts world coordinates to screen coordinates.

```typescript
worldToScreen(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  world_pos: Vec3
): Vec2 | null
```

**Parameters:**

- `window`: Window information
- `transform`: Camera transform matrix
- `frustum`: Camera frustum
- `world_pos`: Position in world coordinates

**Returns:**

Screen coordinates, or null if outside the field of view

**Example:**

```typescript
const screenPos = worldToScreen(
  window,
  cameraTransform,
  frustum,
  worldPosition
);
if (screenPos) {
  console.log(`Screen coordinates: [${screenPos.x}, ${screenPos.y}]`);
}
```

## Intersection and Ray Casting

A set of functions for intersection tests and ray casting.

### getPlaneFromPointNormal(point, normal)

Creates a plane from a point and a normal vector.

```typescript
getPlaneFromPointNormal(point: Vec3, normal: Vec3): Plane
```

**Parameters:**

- `point`: A point on the plane
- `normal`: The normal vector of the plane

**Returns:**

The created plane

**Example:**

```typescript
const point = { x: 0, y: 0, z: 0 };
const normal = { x: 0, y: 0, z: 1 }; // Z-axis direction
const plane = getPlaneFromPointNormal(point, normal);
```

### getPickRay(window, transform, frustum, screen_pos)

Generates a picking ray from screen coordinates.

```typescript
getPickRay(
  window: Window,
  transform: Transform,
  frustum: CameraFrustum,
  screen_pos: Vec2
): Ray
```

**Parameters:**

- `window`: Window information
- `transform`: Camera transform matrix
- `frustum`: Camera frustum
- `screen_pos`: Screen coordinates

**Returns:**

The generated ray

**Example:**

```typescript
const ray = getPickRay(window, cameraTransform, frustum, { x: 400, y: 300 });
console.log(`Ray origin: [${ray.origin.x}, ${ray.origin.y}, ${ray.origin.z}]`);
```

### getRayPlaneIntersection(ray, plane)

Calculates the intersection point of a ray and a plane.

```typescript
getRayPlaneIntersection(ray: Ray, plane: Plane): Vec3 | null
```

**Parameters:**

- `ray`: The ray for intersection testing
- `plane`: The plane for intersection testing

**Returns:**

The coordinates of the intersection point, or null if there is no intersection

**Example:**

```typescript
const intersection = getRayPlaneIntersection(ray, plane);
if (intersection) {
  console.log(
    `Intersection: [${intersection.x}, ${intersection.y}, ${intersection.z}]`
  );
}
```

### getHeightFromEllipsoid(point)

Retrieves the height above the ellipsoid for a given point.

```typescript
getHeightFromEllipsoid(point: Vec3): number
```

**Parameters:**

- `point`: The ECEF coordinates of the point to calculate the height for

**Returns:**

The height above the ellipsoid (in meters)

**Example:**

```typescript
const height = getHeightFromEllipsoid({ x: -3946416, y: 3364068, z: 3702654 });
console.log(`Height: ${height} m`);
```

## Surface Normal and Reference Frames

A set of functions for calculating surface normal vectors and reference frames.

### geodeticSurfaceNormal(lle)

Calculates the surface normal vector at a geodetic coordinate.

```typescript
geodeticSurfaceNormal(lle: LLE): Vec3
```

**Parameters:**

- `lle`: Geodetic coordinates

**Returns:**

The normalized surface normal vector

**Example:**

```typescript
const lle = { lat: 0.6283, lng: 2.4435, height: 0 };
const normal = geodeticSurfaceNormal(lle);
console.log(`Normal vector: [${normal.x}, ${normal.y}, ${normal.z}]`);
```

### eastNorthUpToFixedFrame(origin)

Retrieves the transformation matrix from the East-North-Up coordinate system to the fixed frame.

```typescript
eastNorthUpToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: The ECEF coordinates of the origin

**Returns:**

A 4x4 transformation matrix (16-element array in column-major order)

**Example:**

```typescript
const origin = { x: -3946416, y: 3364068, z: 3702654 };
const matrix = eastNorthUpToFixedFrame(origin);
// Use as a 4x4 matrix
```

### northEastDownToFixedFrame(origin)

Retrieves the transformation matrix from the North-East-Down coordinate system to the fixed frame.

```typescript
northEastDownToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: The ECEF coordinates of the origin

**Returns:**

A 4x4 transformation matrix (16-element array in column-major order)

### northUpEastToFixedFrame(origin)

Retrieves the transformation matrix from the North-Up-East coordinate system to the fixed frame.

```typescript
northUpEastToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: The ECEF coordinates of the origin

**Returns:**

A 4x4 transformation matrix (16-element array in column-major order)

### northWestUpToFixedFrame(origin)

Retrieves the transformation matrix from the North-West-Up coordinate system to the fixed frame.

```typescript
northWestUpToFixedFrame(origin: Vec3): number[]
```

**Parameters:**

- `origin`: The ECEF coordinates of the origin

**Returns:**

A 4x4 transformation matrix (16-element array in column-major order)

## Usage Examples

### Basic Coordinate Transformation

```typescript
// Convert degrees to radians
const latRad = angleToRadian(35.6762); // Latitude of Tokyo
const lngRad = angleToRadian(139.6503); // Longitude of Tokyo

// Convert geodetic coordinates to ECEF coordinates
const lle = { lat: latRad, lng: lngRad, height: 100 };
const ecef = geodeticToXyz(lle);

// Convert ECEF coordinates back to geodetic coordinates
const convertedLle = xyzToGeodetic(ecef);
```

### Screen Picking

```typescript
// Generate a ray from the mouse position
const mousePos = { x: event.clientX, y: event.clientY };
const ray = getPickRay(window, cameraTransform, frustum, mousePos);

// Calculate the intersection with the ground
const groundPlane = getPlaneFromPointNormal(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }
);
const intersection = getRayPlaneIntersection(ray, groundPlane);

if (intersection) {
  console.log("Clicked position on the ground:", intersection);
}
```

### Using Coordinate System Transformation Matrices

```typescript
// Set up the East-North-Up coordinate system at the Tokyo location
const tokyoEcef = geodeticToXyz({
  lat: angleToRadian(35.6762),
  lng: angleToRadian(139.6503),
  height: 0,
});

const enuMatrix = eastNorthUpToFixedFrame(tokyoEcef);
// Use this matrix to place objects in the local coordinate system
```
