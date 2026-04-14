import type ThreeView from "../index";

import { LayerRegistry } from "./LayerRegistry";
import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
} from "./MeshLayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConstructor<
  TConfig extends MeshLayerConfig = MeshLayerConfig,
> = new (
  view: ThreeView,
  ctx: ViewContext,
  config: TConfig,
) => MeshLayerDeclaration;

export class MeshLayerRegistry extends LayerRegistry<
  MeshLayerConstructor,
  MeshLayerDeclaration,
  MeshLayerConfig
> {
  create(name: string, config: MeshLayerConfig): MeshLayerDeclaration {
    const MeshClass = this.getConstructor(name);
    if (!MeshClass) {
      throw new Error(`Unknown mesh type: ${name}`);
    }
    return new MeshClass(this.view, this.ctx, config);
  }

  /**
   * Find mesh type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findMeshType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
