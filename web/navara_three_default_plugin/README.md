# @navaramap/three-default-plugin

The default plugin for `@navaramap/three`. It registers all built-in mesh, light, and effect descriptors from `@navaramap/three-default-descs` (boxes, GLTF models, sky, stars, sun, ambient light, SSAO, bloom, tone mapping, and so on) under their standard keys, so they can be used through `view.addMesh()`, `view.addLight()`, and `view.addEffect()`.

## Usage

Add the plugin before `view.init()`, and parameterize the view with `DefaultDescriptions` so descriptor keys are typed:

```typescript
import ThreeView, {
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";

const view = new ThreeView<DefaultDescriptions>();
const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin); // must happen before init()
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

After `init()`, `addDefaultPhotorealScene()` sets up a photorealistic base scene in one call — sky, stars, sun, sky light probe, aerial perspective, lens flare, tone mapping, and antialiasing — and returns the handles so each piece can be updated or removed later. Combine it with terrain and satellite imagery (credited through the view's built-in attribution UI) for a realistic globe:

```typescript
const scene = defaultPlugin.addDefaultPhotorealScene();

// Terrain first (layer render order = add order), then imagery draped over it.
const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
  requestWaterMask: true,
});
view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: { castShadow: true, receiveShadow: true },
});

const imagery = view.addSource({
  type: "raster-tile",
  url:
    "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default" +
    "&tilematrixset=g&Service=WMTS&Request=GetTile" +
    "&Version=1.0.0&Format=image%2Fjpeg" +
    "&TileMatrix={z}&TileCol={x}&TileRow={y}",
  maxZoom: 15,
});
view.addLayer({ type: "raster", source: imagery });

// Credit the data through the built-in attribution UI.
view.attribution?.add([
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attributionHtml:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
  },
]);

// Tweak individual pieces via the returned handles.
scene.sun.update({ sun: { castShadow: true } });
```

The package also re-exports every descriptor class and config type from `@navaramap/three-default-descs`, so typed `addMesh<T>` / `addEffect<T>` / `addLight<T>` calls need only this one import.

## Documentation

See https://navara-docs.netlify.app/ for the full list of built-in descriptors and their options.

## License

MIT OR Apache-2.0
