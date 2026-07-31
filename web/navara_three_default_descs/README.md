# @navaramap/three-default-descs

The built-in mesh, light, and effect descriptors for `@navaramap/three`. Meshes range from primitives (box, sphere, cylinder, plane, tube, lines) to GLTF models, Gaussian splats, instanced variants, and atmosphere-related meshes (sky, stars). Lights cover the sun, ambient light, and light probes. Effects include aerial perspective, clouds, SSAO, SSR, selective bloom/outline, depth of field, tone mapping, and antialiasing (SMAA/FXAA).

Most applications don't depend on this package directly: `@navaramap/three-default-plugin` registers everything here under standard keys and re-exports all classes and config types. Depend on this package directly when you want to register only a subset of descriptors yourself, or when you need the descriptor classes and config types without the plugin:

```typescript
import ThreeView, {
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import {
  BoxMeshDesc,
  type BoxMeshConfig,
} from "@navaramap/three-default-descs";

const view = new ThreeView<{ mesh: BoxMeshConfig }>();
view.registerMesh("box", BoxMeshDesc); // before init()
await view.init();

// Place the mesh on the globe via a local tangent frame at the target lng/lat.
const origin = geodeticToVector3({
  lng: degreeToRadian(139.77),
  lat: degreeToRadian(35.68),
  height: 0,
});
view.addMesh({
  box: { width: 100, height: 100, depth: 100 },
  matrixWorld: northUpEastToFixedFrame(origin),
});
```

These descriptors are also reference implementations for writing custom descriptors on top of the `MeshDesc` / `LightDesc` / `EffectDesc` base classes from `@navaramap/three`.

## Documentation

Every descriptor and its options are documented at https://navara-docs.netlify.app/.

## License

MIT OR Apache-2.0
