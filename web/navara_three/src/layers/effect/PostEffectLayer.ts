import {
  Vector2,
  Color,
  Mesh,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Group,
  Points,
  Line,
  Sprite,
  ShaderMaterial,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
  type Texture,
} from "three";

import { BufferView } from "../../bufferView";
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import {
  type PostEffectResources,
  type PostEffectConfig,
  type PostEffectHelper,
  getPostEffectConfig,
  PostEffectOcclusionMode,
} from "../../core/PostEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import type { Scenes } from "../../scene";

import type { MRTPassEffectLayer } from "./MRTPassEffectLayer";

// ============================================
// Shared types and utilities for PostEffect passes
// ============================================

/**
 * Filter function type for determining if an object should be included in a mask pass
 */
export type PostEffectFilter = (
  config: PostEffectConfig | undefined,
  registry: PostEffectHelper | undefined,
) => boolean;

/**
 * Saved renderer state for restoration after mask rendering
 */
export type RendererState = {
  clearColor: Color;
  clearAlpha: number;
  renderTarget: WebGLRenderTarget | null;
};

/**
 * Save current renderer state
 */
export function saveRendererState(renderer: WebGLRenderer): RendererState {
  const clearColor = new Color();
  renderer.getClearColor(clearColor);
  return {
    clearColor,
    clearAlpha: renderer.getClearAlpha(),
    renderTarget: renderer.getRenderTarget(),
  };
}

/**
 * Restore renderer state
 */
export function restoreRendererState(
  renderer: WebGLRenderer,
  state: RendererState,
): void {
  renderer.setRenderTarget(state.renderTarget);
  renderer.setClearColor(state.clearColor, state.clearAlpha);
}

/**
 * Render mask for a specific occlusion mode
 * Shared implementation for Bloom and Outline passes
 *
 * @param renderer - WebGL renderer
 * @param camera - Camera to render with
 * @param scenes - Scenes to render
 * @param registry - PostEffectHelper for occlusion lookups
 * @param targetMode - PostEffectOcclusionMode.Normal (0) or PostEffectOcclusionMode.Silhouette (2)
 * @param targetRT - Render target to render mask to
 * @param effectFilter - Filter function to determine if object has the effect enabled
 */
export function renderMaskForMode(
  renderer: WebGLRenderer,
  camera: Camera,
  scenes: Scenes,
  registry: PostEffectHelper | undefined,
  targetMode: number,
  targetRT: WebGLRenderTarget,
  effectFilter: PostEffectFilter,
): void {
  // Save renderer state
  const state = saveRendererState(renderer);
  const hiddenObjects = new Map<Object3D, boolean>();

  // Traverse scenes to filter objects by effect AND occlusion mode
  for (const sceneValue of Object.values(scenes)) {
    if (sceneValue instanceof Scene) {
      sceneValue.traverse((obj: Object3D) => {
        // 1. Mesh: check effectIds and occlusion mode
        if (obj instanceof Mesh) {
          const config = getPostEffectConfig(obj);

          // Hide if effect not enabled
          if (!effectFilter(config, registry)) {
            hiddenObjects.set(obj, obj.visible);
            obj.visible = false;
            return;
          }

          // Get occlusion mode from registry via layerId
          const layerId = config?.layerId;
          const occlusion =
            registry?.getLayerPostEffectOcclusion(layerId ?? "") ??
            PostEffectOcclusionMode.Normal;

          // Hide if occlusion mode doesn't match target
          if (occlusion !== targetMode) {
            hiddenObjects.set(obj, obj.visible);
            obj.visible = false;
          }
          return;
        }

        // 2. Container objects (Scene, Group): keep visible for child rendering
        if (obj instanceof Scene || obj instanceof Group) {
          return;
        }

        // 3. Points/Line: check effectIds and occlusion mode
        if (obj instanceof Points || obj instanceof Line) {
          const config = getPostEffectConfig(obj);

          if (!effectFilter(config, registry)) {
            hiddenObjects.set(obj, obj.visible);
            obj.visible = false;
            return;
          }

          const layerId = config?.layerId;
          const occlusion =
            registry?.getLayerPostEffectOcclusion(layerId ?? "") ??
            PostEffectOcclusionMode.Normal;

          if (occlusion !== targetMode) {
            hiddenObjects.set(obj, obj.visible);
            obj.visible = false;
          }
          return;
        }

        // 4. Sprite: always hide from mask (not supported for post effects)
        if (obj instanceof Sprite) {
          if (obj.visible) {
            hiddenObjects.set(obj, true);
            obj.visible = false;
          }
        }
      });
    }
  }

  // Set up for mask rendering
  renderer.setRenderTarget(targetRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);

  // Render scenes (only filtered objects are visible)
  for (const sceneValue of Object.values(scenes)) {
    if (sceneValue instanceof Scene) {
      renderer.render(sceneValue, camera);
    }
  }

  // Restore visibility
  for (const [obj, visible] of hiddenObjects) {
    obj.visible = visible;
  }

  // Restore renderer state
  restoreRendererState(renderer, state);
}

/**
 * Create depth clip material for clipping mask by base scene depth
 * Shared between Bloom and Outline passes
 */
export function createDepthClipMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      tMask: { value: null },
      tMaskDepth: { value: null },
      tBaseDepth: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <packing>

      uniform sampler2D tMask;
      uniform sampler2D tMaskDepth;
      uniform sampler2D tBaseDepth;

      varying vec2 vUv;

      void main() {
        vec4 maskColor = texture2D(tMask, vUv);

        // Simple depth comparison (pass separation handles occlusion mode)
        float baseDepth = unpackRGBAToDepth(texture2D(tBaseDepth, vUv));
        float maskDepth = texture2D(tMaskDepth, vUv).r;

        // If mask is behind Base, clip (output black)
        if (maskDepth > baseDepth + 0.0001) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // Mask is in front of Base, pass through
        gl_FragColor = maskColor;
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Create fullscreen rendering infrastructure
 */
export function createFullscreenQuad(): {
  camera: OrthographicCamera;
  geometry: PlaneGeometry;
} {
  return {
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    geometry: new PlaneGeometry(2, 2),
  };
}

/**
 * Apply depth clip to a mask render target
 *
 * @param renderer - WebGL renderer
 * @param depthClipMaterial - Depth clip shader material
 * @param depthClipScene - Scene containing the depth clip quad
 * @param fullscreenCamera - Orthographic camera for fullscreen rendering
 * @param maskRT - Source mask render target (with depth texture)
 * @param baseDepthTexture - Base scene depth texture (RGBA packed)
 * @param outputRT - Output render target for clipped result
 */
export function applyDepthClip(
  renderer: WebGLRenderer,
  depthClipMaterial: ShaderMaterial,
  depthClipScene: Scene,
  fullscreenCamera: OrthographicCamera,
  maskRT: WebGLRenderTarget,
  baseDepthTexture: Texture | null,
  outputRT: WebGLRenderTarget,
): void {
  depthClipMaterial.uniforms.tMask.value = maskRT.texture;
  depthClipMaterial.uniforms.tMaskDepth.value = maskRT.depthTexture;
  depthClipMaterial.uniforms.tBaseDepth.value = baseDepthTexture;
  renderer.setRenderTarget(outputRT);
  renderer.render(depthClipScene, fullscreenCamera);
}

// Base configuration for post effect layers
export type PostEffectLayerConfig = {
  postEffect: true;
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type PostEffectLayerUpdate = {
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

/**
 * Base class for post effect layers
 * Provides mask rendering and debug visualization
 */
export abstract class PostEffectLayer<
  Config extends PostEffectLayerConfig = PostEffectLayerConfig,
  UpdateConfig extends PostEffectLayerUpdate = PostEffectLayerUpdate,
> extends EffectLayerDeclaration<Config, UpdateConfig> {
  protected resources!: PostEffectResources;
  protected config: Config;
  protected abstract getEffectKey(): string;

  constructor(view: ViewContext, config: Config) {
    super(view, config);
    this.config = config;
  }

  onCreate(): void {
    // Create post effect resources
    if (!this.view.postEffectRegistry) {
      throw new Error("PostEffectRegistry not initialized");
    }

    const debugMask =
      this.config.debugMask ?? this.view.debugOptions.postEffectMask ?? false;
    this.config.debugMask = debugMask;

    this.resources = this.view.postEffectRegistry.create(
      this.id,
      this.getEffectKey(),
      {
        resolutionScale: this.config.resolutionScale ?? 1.0,
        debugMask,
      },
    );

    super.onCreate();
  }

  /**
   * Render debug mask visualization
   */
  protected renderDebugMask(): void {
    if (!this.resources.maskDebug) return;

    this.resources.maskDebug.render(
      this.view.renderPassOrchestrator.effectComposer.getRenderer(),
      this.resources.maskRT,
    );
  }

  /**
   * Get the base depth texture from MRT pass for depth comparison
   * Uses allDepthCopyPass.texture which contains the entire scene depth (globe + MRT + opaque)
   * Format: RGBA packed depth, requires unpackRGBAToDepth() in shader
   */
  protected getBaseDepthTexture(): Texture | null {
    const mrtPass = this.findLayer<MRTPassEffectLayer>("mrt");
    return mrtPass?.raw?.allDepthCopyPass?.texture ?? null;
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.resolutionScale !== undefined && this.view.postEffectRegistry) {
      // Update resolution scale
      this.resources.options.resolutionScale = updates.resolutionScale;
      const renderer =
        this.view.renderPassOrchestrator.effectComposer.getRenderer();
      const size = renderer.getSize(new Vector2());
      this.view.postEffectRegistry.setSize(size.x, size.y);
    }

    if (updates.debugMask !== undefined) {
      this.config.debugMask = updates.debugMask;
      this.resources.options.debugMask = updates.debugMask;
      // Recreate debug view if needed
      if (updates.debugMask && !this.resources.maskDebug) {
        this.resources.maskDebug = new BufferView(
          this.resources.maskRT.width,
          this.resources.maskRT.height,
        );
      } else if (!updates.debugMask && this.resources.maskDebug) {
        this.resources.maskDebug.dispose();
        this.resources.maskDebug = undefined;
      }
    }
  }

  onDestroy(): void {
    if (this.view.postEffectRegistry) {
      this.view.postEffectRegistry.destroy(this.id);
    }
    super.onDestroy();
  }
}
