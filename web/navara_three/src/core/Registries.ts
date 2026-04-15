import type ThreeView from "../index";

import { EffectLayerRegistry } from "./EffectLayerRegistry";
import { LightLayerRegistry } from "./LightLayerRegistry";
import { MeshLayerRegistry } from "./MeshLayerRegistry";
import type { ViewContext } from "./ViewContext";
// import { ResourceRegistry } from "./ResourceRegistry"; // TODO: Implement when needed

/**
 * Centralized registry manager that bundles all registry types.
 * This provides direct property access to different types of registries
 * in the Navara system.
 */
export class Registries {
  mesh: MeshLayerRegistry;
  light: LightLayerRegistry;
  effect: EffectLayerRegistry;
  // resource: ResourceRegistry; // TODO: Implement when needed
  // pass: PassRegistry; // TODO: Implement when needed
  // material: MaterialRegistry; // TODO: Implement when needed
  // shader: ShaderRegistry; // TODO: Implement when needed

  constructor(view: ThreeView, ctx: ViewContext) {
    this.mesh = new MeshLayerRegistry(view, ctx);
    this.light = new LightLayerRegistry(view, ctx);
    this.effect = new EffectLayerRegistry(view, ctx);
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
