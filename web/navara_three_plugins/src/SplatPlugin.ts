/**
 * SplatPlugin — registers `SplatMeshDesc` under the `"splat"` mesh key so
 * users can render 3D Gaussian Splats via SparkJS through Navara's standard
 * `view.addMesh()` API.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import {
 *   DefaultPlugin,
 *   type DefaultDescriptions,
 * } from "@navara/three_default_plugin";
 * import {
 *   SplatPlugin,
 *   type SplatMeshConfig,
 *   type SplatMeshDesc,
 * } from "@navara/three_plugins";
 *
 * type AppDescriptions = {
 *   mesh: DefaultDescriptions["mesh"] | SplatMeshConfig;
 *   light: DefaultDescriptions["light"];
 *   effect: DefaultDescriptions["effect"];
 * };
 *
 * const view = new ThreeView<AppDescriptions>(...);
 * view.addPlugin(new DefaultPlugin());
 * view.addPlugin(new SplatPlugin());
 * await view.init();
 *
 * view.addMesh<SplatMeshDesc>({
 *   splat: { url: "https://example.com/butterfly.spz", lod: true },
 * });
 * ```
 */
import type ThreeView from "@navara/three";
import { Plugin, type ViewContext } from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";

import { SplatMeshDesc, type SplatMeshConfig } from "./SplatMeshDesc";

export type SplatDescriptions = {
  mesh: SplatMeshConfig;
};

type View = ThreeView<DefaultDescriptions>;

export class SplatPlugin extends Plugin<View, ViewContext> {
  async init(view: View, _ctx: ViewContext): Promise<void> {
    view.registerMesh("splat", SplatMeshDesc);
  }
}
