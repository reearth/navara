/**
 * Debug-only / internal test layer for PostEffect development.
 * Not intended for production use.
 */

import {
  Pass as PostProcessingPass,
  CopyPass as PostProcessingCopyPass,
} from "postprocessing";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  Object3D,
  Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

import type { EffectLayerConfig } from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import {
  getPostEffectConfig,
  ensurePostEffectUserData,
} from "../../core/PostEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  PostEffectLayer,
  type PostEffectLayerConfig,
  type PostEffectLayerUpdate,
} from "./PostEffectLayer";

// Test post effect configuration (uses PostEffect infrastructure)
export type TestPostEffectConfig = {
  testPostEffect: {
    debugMask?: boolean;
    resolutionScale?: number;
  };
} & EffectLayerConfig;

/**
 * Test layer for post effect
 * Renders mask for debugging and passes through the input buffer
 */
export class TestPostEffectLayer extends PostEffectLayer<
  PostEffectLayerConfig,
  PostEffectLayerUpdate
> {
  static key = "testPostEffect";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  protected getEffectKey(): string {
    return TestPostEffectLayer.key;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    // Extract testPostEffect config
    const testPostEffectConfig =
      "testPostEffect" in config
        ? (config as TestPostEffectConfig).testPostEffect
        : {};

    // Ensure config has postEffect: true (PostEffectLayerConfig requires this flag)
    const postEffectConfig: PostEffectLayerConfig = {
      ...config,
      postEffect: true,
      resolutionScale: testPostEffectConfig.resolutionScale ?? 1.0,
      debugMask: testPostEffectConfig.debugMask ?? false,
    };

    super(view, postEffectConfig);
  }

  createPass() {
    // Create custom pass (follows SSAO pattern)
    const rawPass = new TestPostEffectPass(this);
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<TestPostEffectPass, null> & BaseInstance;
  }
}

/**
 * Custom PostProcessing Pass for TestPostEffect
 * Uses mask rendering via scene.traverse
 */
class TestPostEffectPass extends PostProcessingPass {
  private layer: TestPostEffectLayer;
  private copyPass: PostProcessingCopyPass;

  constructor(layer: TestPostEffectLayer) {
    super("TestPostEffectPass");
    this.layer = layer;

    // Create CopyPass for copying input to output
    this.copyPass = new PostProcessingCopyPass();
    // This pass only visualises the mask, so avoid swapping buffers.
    this.needsSwap = false;
  }

  /**
   * Render mask using scene.traverse
   * This is a simplified version that renders all objects with any post effect enabled
   */
  private renderMask(renderer: WebGLRenderer): void {
    const camera = this.layer["view"].camera;
    const scenes = this.layer["view"].scenes;
    const maskRT = this.layer["resources"].maskRT;

    // Collect materials that need state changes
    const materialsToModify = new Map<
      MeshStandardMaterial | MeshPhysicalMaterial,
      {
        originalDepthTest: boolean;
        originalDepthWrite: boolean;
        originalPostEffectOcclusion: number;
      }
    >();

    // Traverse scenes and collect objects with any post effect enabled
    for (const sceneKey of Object.keys(scenes)) {
      const scene = scenes[sceneKey as keyof typeof scenes];
      if (scene instanceof Scene) {
        scene.traverse((obj: Object3D) => {
          if (!(obj instanceof Mesh)) {
            return;
          }

          // Get PostEffectState from the object (or its parent)
          let state = getPostEffectConfig(obj);
          if (!state && obj.parent) {
            state = getPostEffectConfig(obj.parent);
          }

          // Skip if no state or no effects enabled
          if (!state || !state.effectIds || state.effectIds.length === 0) {
            return;
          }

          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];

          for (const material of materials) {
            if (
              material instanceof MeshStandardMaterial ||
              material instanceof MeshPhysicalMaterial
            ) {
              if (!materialsToModify.has(material)) {
                const postEffectUD = ensurePostEffectUserData(material);
                materialsToModify.set(material, {
                  originalDepthTest: material.depthTest,
                  originalDepthWrite: material.depthWrite,
                  originalPostEffectOcclusion:
                    postEffectUD.postEffectOcclusion.value,
                });
              }
            }
          }
        });
      }
    }

    // Save renderer state
    const originalClearColor = new Color();
    renderer.getClearColor(originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const prevRenderTarget = renderer.getRenderTarget();

    // Set up for mask rendering
    renderer.setRenderTarget(maskRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);

    // Render all objects with postEffectOcclusion = 0 (Normal)
    for (const [material] of materialsToModify.entries()) {
      const postEffectUD = ensurePostEffectUserData(material);
      postEffectUD.postEffectOcclusion.value = 0;
      material.depthTest = true;
      material.depthWrite = true;
    }
    for (const sceneKey of Object.keys(scenes)) {
      const scene = scenes[sceneKey as keyof typeof scenes];
      if (scene instanceof Scene) {
        renderer.render(scene, camera);
      }
    }

    // Restore renderer state
    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(originalClearColor, originalClearAlpha);

    // Restore material states
    for (const [material, state] of materialsToModify.entries()) {
      const postEffectUD = ensurePostEffectUserData(material);
      postEffectUD.postEffectOcclusion.value =
        state.originalPostEffectOcclusion;
      material.depthTest = state.originalDepthTest;
      material.depthWrite = state.originalDepthWrite;
    }
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    // Render mask
    this.renderMask(renderer);

    // Render debug visualization if enabled
    if (this.layer["config"].debugMask) {
      this.layer["renderDebugMask"]();
    }

    // Copy input to output using CopyPass
    this.copyPass.renderToScreen = this.renderToScreen;
    this.copyPass.render(renderer, inputBuffer, outputBuffer);
  }

  dispose() {
    this.copyPass.dispose();
  }
}
