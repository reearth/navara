import {
  MeshDeclaration,
  type MeshConfig,
} from "./MeshDeclaration";
import { Registry } from "./Registry";
import type { ViewContext } from "./ViewContext";

export type MeshConstructor<
  TConfig extends MeshConfig = MeshConfig,
> = new (view: ViewContext, config: TConfig) => MeshDeclaration;

export class MeshRegistry extends Registry<
  MeshConstructor,
  MeshDeclaration,
  MeshConfig
> {
  create(name: string, config: MeshConfig): MeshDeclaration {
    const MeshClass = this.getConstructor(name);
    if (!MeshClass) {
      throw new Error(`Unknown mesh type: ${name}`);
    }
    return new MeshClass(this.view, config);
  }

  /**
   * Find mesh type from config (alias for findTypeFromConfig for backward compatibility)
   */
  findMeshType(config: Record<string, unknown>): string | null {
    return this.findTypeFromConfig(config);
  }
}
