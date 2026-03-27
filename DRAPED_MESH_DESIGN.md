# DrapedMesh design

We have a draped mesh by the stencil test support for polygon, but it isn't used now, since all polygon rendering is migrated to be rendered as a texture.

The previous flow was like below.

1. Mesh is added through `web/navara_three/src/event/feature.ts`.
2. The polygon mesh is constructed in `web/navara_three/src/mesh/polygon.ts`.
3. If it is not tile based(Not texturized) polygon and `clampToGround` is `true`, the material is pushed to `drapedFeatureMaterials`.
4. The draped mesh is rendered in `web/navara_three/src/passes/CustomRenderPass.ts` considering the stencil test draping method.

As I mentioned above, those process is not longer needed for the polygon mesh. However I'd like to generalize these process for a mesh layer defined in `web/navara_three_default_layers/src/meshes`.
It means I'd like to make an independent mesh class like `DrapedMesh` which can be used in the independent `web/navara_three_default_layers` package.

Fortunately, the base class of the mesh layer has `getPassKey` method that specifies the scene, so `navara_three` provide `drapedScene`, and the draped mesh is added to the scene.

`DrapedMesh` should be used in box and cylinder defined in `web/navara_three_default_layers/src/meshes` if `draped` option is true. User can switch `draped` option dynamically. If it is false, the mesh should be rendered as usual. It it is true, the mesh should be draped on the terrain by the stencil test way.

## Steps

1. Remove the unnecessary draping method.
2. Add `DrapedMesh`
3. DrapedMesh is used in box and cylinder mesh layer.
   1. DrapedMesh should work same as Three.js Mesh class.
   2. You can define it like `new DrapedMesh(geometry, material)`
   3. If `enable` is true, the mesh works to drape it.
4. Now you can specify `draped` scene in `getPassKey` when `draped` is enabled in the layer.
5. CustomRenderPass renders `draped` scene, not `this._drapedFeatureMaterials`. `this._drapedFeatureMaterials` should be removed.
   1. The temporal scene for draping is made as a method of CustomRenderPass class.
