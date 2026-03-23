import { describe, expect, it, vi } from "vitest";

import { Plugin, PluginManager } from "./plugin";

class TestPlugin extends Plugin<{ name: string }> {
  static id = "TestPlugin";
  async init(_view: { name: string }) {}
}

class AnotherPlugin extends Plugin<{ name: string }> {
  static id = "AnotherPlugin";
  async init(_view: { name: string }) {}
}

class NoNamePlugin extends Plugin<{ name: string }> {
  async init(_view: { name: string }) {}
}

class ErrorPlugin extends Plugin<{ name: string }> {
  static id = "ErrorPlugin";
  async init(_view: { name: string }) {
    throw new Error();
  }
}

describe("PluginManager", () => {
  const view = { name: "test-view" };

  it("addPlugin calls init() with the view", async () => {
    const manager = new PluginManager(view);
    const plugin = new TestPlugin();
    const initSpy = vi.spyOn(plugin, "init");

    await manager.addPlugin(plugin);

    expect(initSpy).toHaveBeenCalledWith(view);
    expect(manager.hasPlugin("TestPlugin")).toBe(true);
  });

  it("addPlugin throws on duplicate id", async () => {
    const manager = new PluginManager(view);
    await manager.addPlugin(new TestPlugin());

    await expect(manager.addPlugin(new TestPlugin())).rejects.toThrow(
      'Plugin "TestPlugin" is already registered.',
    );
  });

  it("addPlugin throws when id is not defined", async () => {
    const manager = new PluginManager(view);

    await expect(manager.addPlugin(new NoNamePlugin())).rejects.toThrow(
      'Plugin must define a static "id"',
    );
  });

  it("removePlugin calls dispose() and returns true", async () => {
    const manager = new PluginManager(view);
    const plugin = new TestPlugin();
    const disposeSpy = vi.spyOn(plugin, "dispose");

    await manager.addPlugin(plugin);
    const result = await manager.removePlugin("TestPlugin");

    expect(result).toBe(true);
    expect(disposeSpy).toHaveBeenCalled();
    expect(manager.hasPlugin("TestPlugin")).toBe(false);
  });

  it("removePlugin returns false for unknown name", async () => {
    const manager = new PluginManager(view);
    const result = await manager.removePlugin("NonExistent");
    expect(result).toBe(false);
  });

  it("disposeAll disposes all plugins and clears the registry", async () => {
    const manager = new PluginManager(view);
    const plugin1 = new TestPlugin();
    const plugin2 = new AnotherPlugin();
    const dispose1 = vi.spyOn(plugin1, "dispose");
    const dispose2 = vi.spyOn(plugin2, "dispose");

    await manager.addPlugin(plugin1);
    await manager.addPlugin(plugin2);

    await manager.disposeAll();

    expect(dispose1).toHaveBeenCalled();
    expect(dispose2).toHaveBeenCalled();
    expect(manager.hasPlugin("TestPlugin")).toBe(false);
    expect(manager.hasPlugin("AnotherPlugin")).toBe(false);
  });

  it("getPlugin returns the plugin instance", async () => {
    const manager = new PluginManager(view);
    const plugin = new TestPlugin();

    await manager.addPlugin(plugin);

    expect(manager.getPlugin("TestPlugin")).toBe(plugin);
    expect(manager.getPlugin("Unknown")).toBeUndefined();
  });

  it("should not have the added plugin when an error occurs", async () => {
    const manager = new PluginManager(view);
    const plugin = new ErrorPlugin();

    try {
      await manager.addPlugin(plugin);
    } catch {
      // noop
    }

    expect(manager.getPlugin("ErrorPlugin")).toBeUndefined();
  });
});
