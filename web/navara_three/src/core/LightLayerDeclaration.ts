import type { XYZ } from "@navara/core";
import { Light } from "three";

import type ThreeView from "../index";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type LightLayerConfig = {
  type: "light";
  position?: XYZ;
} & LayerDeclarationConfig;

export type LightLayerUpdate = Pick<LightLayerConfig, "position"> &
  LayerDeclarationConfigUpdate;

export type LightBaseInstance<Instance extends object = object> =
  Instance extends Light
    ? Instance
    : Instance extends {
          raw: infer Raw extends Light;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : BaseInstance;

/**
 * Abstract base class for creating custom light layers.
 *
 * Extend this class to add custom Three.js lights (directional, point, spot, ambient, etc.)
 * to the Navara scene. The light is automatically added to `view.scenes.light` and
 * position synchronization is handled by the base class.
 *
 * ## Implementing a Custom Light Layer
 *
 * ### 1. Define configuration types
 *
 * Create a description type for your light-specific options, then merge it with the
 * base config and update types:
 *
 * ```typescript
 * type MyLightDescription = {
 *   myLight?: {
 *     intensity?: number;
 *     color?: Color;
 *   };
 * };
 *
 * type MyLightConfig = LightLayerConfig & MyLightDescription;
 * type MyLightUpdate = LightLayerUpdate & MyLightDescription;
 * ```
 *
 * ### 2. Extend `LightLayerDeclaration`
 *
 * Implement the {@link createLight} factory method. Optionally override
 * {@link onUpdateConfig} for dynamic property updates and {@link update} for
 * per-frame animation.
 *
 * ```typescript
 * class MyLightLayer extends LightLayerDeclaration<
 *   MyLightConfig,
 *   MyLightUpdate,
 *   PointLight
 * > {
 *   private config: MyLightConfig;
 *
 *   constructor(view: ThreeView, ctx: ViewContext, config: MyLightConfig) {
 *     super(view, ctx, config);
 *     this.config = config;
 *   }
 *
 *   createLight() {
 *     const cfg = this.config.myLight ?? {};
 *     return new PointLight(
 *       cfg.color?.raw ?? 0xffffff,
 *       cfg.intensity ?? 1,
 *     );
 *   }
 *
 *   onUpdateConfig(updates: MyLightUpdate): void {
 *     super.onUpdateConfig(updates);
 *     if (updates.myLight && this._instance) {
 *       if (updates.myLight.intensity !== undefined) {
 *         this._instance.intensity = updates.myLight.intensity;
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ### 3. Register and use the layer
 *
 * ```typescript
 * view.registerLight("myLight", MyLightLayer);
 *
 * const handle = view.addLayer<MyLightLayer>({
 *   type: "light",
 *   position: { x: 0, y: 100, z: 0 },
 *   myLight: { intensity: 2, color: new Color("#ff0000") },
 * });
 *
 * // Update dynamically
 * handle.update({ myLight: { intensity: 0.5 } });
 *
 * // Remove the layer
 * handle.delete();
 * ```
 *
 * ## Lifecycle
 *
 * 1. **Construction** - The layer is instantiated with the view context and config.
 * 2. **{@link createLight}** - Called during {@link onCreate} to create the Three.js light.
 *    The base class adds it to `view.scenes.light` and applies the initial position.
 * 3. **{@link onUpdateConfig}** - Called when `handle.update()` is invoked. The base class
 *    handles `visible` and `position`; override to handle your custom properties.
 * 4. **{@link update}** - Optional per-frame callback for animation (e.g. moving lights).
 * 5. **{@link onDestroy}** - Called on `handle.delete()`. The base class removes the light
 *    from its parent scene.
 *
 * @see {@link AmbientLightLayer} for a minimal built-in example.
 * @see {@link SunLightLayer} for an advanced example with CSM shadows and atmosphere integration.
 *
 * @typeParam Config - Layer configuration type (extends {@link LightLayerConfig})
 * @typeParam UpdateConfig - Updatable properties (extends {@link LightLayerUpdate})
 * @typeParam InstanceObj - The Three.js Light type or a wrapper with a `raw` property
 * @typeParam Instance - Resolved instance type (inferred automatically)
 */
export abstract class LightLayerDeclaration<
  Config extends LightLayerConfig = LightLayerConfig,
  UpdateConfig extends LightLayerUpdate = LightLayerUpdate,
  InstanceObj extends Light | { raw: Light } = Light | { raw: Light },
  Instance extends LightBaseInstance<InstanceObj> =
    LightBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance> {
  public position?: XYZ;

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: Config = {} as Config,
  ) {
    super(view, ctx, config);
    this.position = config.position;
  }

  /**
   * Factory method to create the Three.js light instance.
   *
   * Override this to return your custom light. The returned object can be either:
   * - A Three.js `Light` directly (e.g. `PointLight`, `DirectionalLight`)
   * - A wrapper object with a `raw` property containing the `Light`
   *
   * The base class calls this during {@link onCreate} and automatically adds the
   * light to `view.scenes.light`.
   */
  abstract createLight(): Instance;

  get raw() {
    if (!this._instance) return;

    if (this._instance instanceof Light) {
      return this._instance as Instance extends Light ? Instance : never;
    }
    if ("raw" in this._instance) {
      return this._instance.raw as Instance extends {
        raw: infer Raw extends Light;
      }
        ? Raw
        : never;
    }
    return;
  }

  onCreate() {
    this._instance = this.createLight();

    if (this._instance) {
      this._instance.visible = this.visible;
    }

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    // Add to scene
    if (this.raw) {
      this.ctx.scenes.light.add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.position) {
      this.raw?.position.copy(updates.position);
    }
  }

  onDestroy(): void {
    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    this._instance = undefined;
  }

  /**
   * Optional per-frame update callback.
   * Override this to animate the light (e.g. orbiting, flickering, color shifts).
   * @param time - High-resolution timestamp (in milliseconds) provided by the render loop,
   *   the same value passed to `requestAnimationFrame` callbacks.
   */
  update?(time: number): void;
}
