import type { LayerView } from "./LayerView";

/**
 * Base abstract class for all registry types in the Navara system.
 * Provides common functionality for registering, creating, and managing different types of components.
 */
export abstract class LayerRegistry<
  TConstructor,
  TInstance,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  protected registry = new Map<string, TConstructor>();

  constructor(public view: LayerView) {}

  /**
   * Register a new type with the given name and constructor
   */
  register(name: string, constructor: TConstructor): void {
    this.registry.set(name, constructor);
  }

  /**
   * Unregister a type by name
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Check if a type is registered
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Get all registered type names
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get the number of registered types
   */
  size(): number {
    return this.registry.size;
  }

  /**
   * Clear all registered types
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Create an instance of the specified type with the given configuration
   * Must be implemented by subclasses
   */
  abstract create(name: string, config: TConfig): TInstance;

  /**
   * Find a type name from a configuration object
   * Useful for auto-detecting type from config keys
   */
  findTypeFromConfig(config: Record<string, unknown>): string | null {
    for (const key of Object.keys(config)) {
      if (this.registry.has(key)) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get constructor by name (protected method for subclasses)
   */
  protected getConstructor(name: string): TConstructor | undefined {
    return this.registry.get(name);
  }
}
