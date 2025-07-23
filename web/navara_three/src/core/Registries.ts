import type { LayerView } from "./LayerView";
import { MeshLayerRegistry } from "./MeshLayerRegistry";
// import { EffectRegistry } from "./EffectRegistry"; // TODO: Uncomment when needed
// import { ResourceRegistry } from "./ResourceRegistry"; // TODO: Implement when needed

/**
 * Centralized registry manager that bundles all registry types.
 * This provides direct property access to different types of registries
 * in the Navara system.
 */
export class Registries {
  mesh: MeshLayerRegistry;
  // effect: EffectRegistry; // TODO: Uncomment when needed
  // resource: ResourceRegistry; // TODO: Implement when needed
  // pass: PassRegistry; // TODO: Implement when needed
  // material: MaterialRegistry; // TODO: Implement when needed
  // shader: ShaderRegistry; // TODO: Implement when needed

  constructor(view: LayerView) {
    this.mesh = new MeshLayerRegistry(view);
    // this.effect = new EffectRegistry(); // TODO: Uncomment when needed
  }

  /**
   * Get registry statistics for debugging and monitoring
   */
  getStats(): Record<string, any> {
    return {
      mesh: {
        registeredCount: this.mesh.size(),
        types: this.mesh.getRegisteredTypes(),
      },
      // TODO: Add other registries when implemented
    };
  }

  /**
   * Clear all registries
   */
  clearAll(): void {
    this.mesh.clear();
    // TODO: Clear other registries when implemented
  }
}
