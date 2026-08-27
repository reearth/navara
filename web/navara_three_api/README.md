# @navaramap/three-api

Standalone geodetic and GIS math for Three.js, powered by Navara's WASM core. It covers geodetic ⇔ ECEF conversion, WGS84 ellipsoid constants and surface normals, local tangent frames (ENU/NED/NUE/NWU/WUN and heading/pitch/roll placement), screen ⇔ world projection and pick rays, ray/plane intersection, ellipsoid geodesics, and RTE (relative-to-eye) encoding for jitter-free rendering far from the origin. Everything is integrated with the Three.js type system (`Vector3`, `Matrix4`, cameras).

Unlike the rest of the Navara stack, this package is usable without the map engine: it is the standalone form of Navara's API tier, for pure geometry computation in any Three.js app.

## Usage

Initialize the WASM module once before calling anything else (when using `@navaramap/three`, `view.init()` does this for you):

```typescript
import { initNavaraApi, geodeticToVector3 } from "@navaramap/three-api";

await initNavaraApi();

// Geodetic coordinates (degrees, meters) to ECEF Cartesian.
const position = geodeticToVector3({
  lng: 139.77,
  lat: 35.68,
  height: 0,
});
```

All of these utilities are also re-exported by `@navaramap/three`, so applications using the map engine don't need a direct dependency on this package.

## Documentation

Every function is documented at https://navara-docs.reearth.workers.dev/.

## License

MIT OR Apache-2.0
