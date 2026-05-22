import type ThreeView from "../index";

import type { AnyMeshDesc } from "./BaseHandle";
import { DescRegistry } from "./DescRegistry";
import type { MeshConfig } from "./MeshDesc";
import type { MeshDescBaseConfig } from "./MeshDescBase";
import type { ViewContext } from "./ViewContext";

/**
 * Union of legacy and TSL config types. The registry accepts subclasses from
 * either hierarchy during the incremental TSL migration.
 */
export type AnyMeshConfig = MeshConfig | MeshDescBaseConfig;

export type MeshDescConstructor<TConfig extends AnyMeshConfig = AnyMeshConfig> =
  new (view: ThreeView, ctx: ViewContext, config: TConfig) => AnyMeshDesc;

export class MeshDescRegistry extends DescRegistry<
  MeshDescConstructor,
  AnyMeshDesc,
  AnyMeshConfig
> {
  create(name: string, config: AnyMeshConfig): AnyMeshDesc {
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
