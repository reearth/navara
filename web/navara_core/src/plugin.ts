/**
 * Base `Plugin` abstract class.
 * This class doesn't have a logic, but has interfaces.
 *
 * Concrete plugins **must** override the static `id` with a unique string
 * so that `PluginManager` can enforce one-instance-per-name.
 *
 * ```
 * class MyPlugin extends Plugin<ThreeView<MyCustomLayers>> {
 *   static override id = "MyPlugin";
 *   async init(view) {
 *     // ...
 *   }
 * }
 * ```
 */
// DO NOT add a logic to this class as much as possible.
export abstract class Plugin<TView = unknown> {
  static id: string;

  abstract init(view: TView): Promise<void>;

  async dispose(): Promise<void> {}
}

/**
 * Manages plugin lifecycle: uniqueness enforcement, initialization, and disposal.
 */
export class PluginManager<TView> {
  private plugins = new Map<string, Plugin<TView>>();
  private view: TView;

  constructor(view: TView) {
    this.view = view;
  }

  /**
   * Add a plugin and immediately initialize it.
   * Throws if `id` is empty or a plugin with the same id is already registered.
   */
  async addPlugin(plugin: Plugin<TView>): Promise<void> {
    const name = (plugin.constructor as typeof Plugin).id;

    if (!name) {
      throw new Error(
        `Plugin must define a static "id". Got: ${plugin.constructor.name}`,
      );
    }

    if (this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is already registered.`);
    }

    this.plugins.set(name, plugin);
    await plugin.init(this.view);
  }

  /** Add multiple plugins sequentially. */
  async addPlugins(plugins: Plugin<TView>[]): Promise<void> {
    for (const plugin of plugins) {
      await this.addPlugin(plugin);
    }
  }

  /** Remove a plugin by name, calling its `dispose()` method. */
  async removePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    await plugin.dispose();
    this.plugins.delete(name);
    return true;
  }

  /** Get a plugin by name. */
  getPlugin(name: string): Plugin<TView> | undefined {
    return this.plugins.get(name);
  }

  /** Check if a plugin is registered. */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /** Dispose all plugins and clear the registry. */
  async disposeAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.dispose();
    }
    this.plugins.clear();
  }
}
