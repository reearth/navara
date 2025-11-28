import {
  Pass as PostProcessingPass,
  CopyPass as PostProcessingCopyPass,
} from "postprocessing";
import type { WebGLRenderer, WebGLRenderTarget } from "three";

import type { EffectLayerConfig } from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  PostEffectLayerBase,
  type PostEffectConfig,
  type PostEffectUpdate,
} from "./SelectiveEffectLayer";

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
export class TestPostEffectLayer extends PostEffectLayerBase<
  PostEffectConfig,
  PostEffectUpdate
> {
  static key = "testPostEffect";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  constructor(view: ViewContext, config: EffectLayerConfig) {
    // Extract testPostEffect config
    const testPostEffectConfig =
      "testPostEffect" in config
        ? (config as TestPostEffectConfig).testPostEffect
        : {};

    // Ensure config has selective: true (PostEffectConfig requires selective flag)
    const postEffectConfig: PostEffectConfig = {
      ...config,
      selective: true,
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
 * Defined after TestPostEffectLayer to access protected members
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

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    // Render mask to maskRT
    this.layer["renderMask"](renderer);

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
