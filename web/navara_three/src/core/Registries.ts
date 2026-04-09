import { EffectRegistry } from "./EffectRegistry";
import { LightRegistry } from "./LightRegistry";
import { MeshRegistry } from "./MeshRegistry";
import type { ViewContext } from "./ViewContext";
// import { ResourceRegistry } from "./ResourceRegistry"; // TODO: Implement when needed

/**
 * Centralized registry manager that bundles all registry types.
 * This provides direct property access to different types of registries
 * in the Navara system.
 */
export class Registries {
  mesh: MeshRegistry;
  light: LightRegistry;
  effect: EffectRegistry;
  // resource: ResourceRegistry; // TODO: Implement when needed
  // pass: PassRegistry; // TODO: Implement when needed
  // material: MaterialRegistry; // TODO: Implement when needed
  // shader: ShaderRegistry; // TODO: Implement when needed

  constructor(view: ViewContext) {
    this.mesh = new MeshRegistry(view);
    this.light = new LightRegistry(view);
    this.effect = new EffectRegistry(view);
  }

  /**
   * Get registry statistics for debugging and monitoring
   */
  getStats() {
    return {
      mesh: {
        registeredCount: this.mesh.size(),
        types: this.mesh.getRegisteredTypes(),
      },
      light: {
        registeredCount: this.light.size(),
        types: this.light.getRegisteredTypes(),
      },
      effect: {
        registeredCount: this.effect.size(),
        types: this.effect.getRegisteredTypes(),
      },
      // TODO: Add other registries when implemented
    };
  }

  /**
   * Clear all registries
   */
  clearAll(): void {
    this.mesh.clear();
    this.light.clear();
    this.effect.clear();
    // TODO: Clear other registries when implemented
  }
}
