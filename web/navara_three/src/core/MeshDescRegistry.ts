import type ThreeView from "../index";

import { DescRegistry } from "./DescRegistry";
import { MeshDesc, type MeshConfig } from "./MeshDesc";
import type { ViewContext } from "./ViewContext";

export type MeshDescConstructor<TConfig extends MeshConfig = MeshConfig> =
  new (view: ThreeView, ctx: ViewContext, config: TConfig) => MeshDesc;

export class MeshDescRegistry extends DescRegistry<
  MeshDescConstructor,
  MeshDesc,
  MeshConfig
> {
  create(name: string, config: MeshConfig): MeshDesc {
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
