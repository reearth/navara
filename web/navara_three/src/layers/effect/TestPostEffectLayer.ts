/**
 * Debug-only / internal test layer for PostEffect development.
 * Not intended for production use.
 */

import {
  Pass as PostProcessingPass,
  CopyPass as PostProcessingCopyPass,
} from "postprocessing";
import { type WebGLRenderer, type WebGLRenderTarget } from "three";

import type { EffectLayerConfig } from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import { PostEffectOcclusionMode } from "../../core/PostEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  PostEffectLayer,
  renderMaskForMode,
  type PostEffectLayerUpdate,
} from "./PostEffectLayer";

// Test post effect configuration (uses PostEffect infrastructure)
export type TestPostEffectConfig = {
  postEffect: true;
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
  TestPostEffectConfig,
  PostEffectLayerUpdate
> {
  static key = "testPostEffect";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  protected getEffectKey(): string {
    return TestPostEffectLayer.key;
  }

  protected getResolutionScale(): number {
    return this.config.testPostEffect?.resolutionScale ?? 1.0;
  }

  protected getDebugMask(): boolean {
    return this.config.testPostEffect?.debugMask ?? false;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    // Extract testPostEffect config
    const testPostEffectConfig =
      "testPostEffect" in config
        ? (config as TestPostEffectConfig).testPostEffect
        : {};

    // Ensure config has postEffect: true and nested testPostEffect config
    const postEffectConfig: TestPostEffectConfig = {
      ...(config as TestPostEffectConfig),
      postEffect: true,
      testPostEffect: {
        resolutionScale: testPostEffectConfig.resolutionScale ?? 1.0,
        debugMask: testPostEffectConfig.debugMask ?? false,
      },
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
 * Uses shared renderMaskForMode for mask rendering
 */
class TestPostEffectPass extends PostProcessingPass {
  private layer: TestPostEffectLayer;
  private copyPass: PostProcessingCopyPass;

  constructor(layer: TestPostEffectLayer) {
    super("TestPostEffectPass");
    this.layer = layer;

    // Create CopyPass for copying input to output
    this.copyPass = new PostProcessingCopyPass();
    // This pass renders the debug mask and copies input to output, avoiding buffer swap.
    this.needsSwap = false;
  }

  /**
   * Render mask for all objects with any post effect enabled
   * Uses shared renderMaskForMode implementation
   */
  private renderMask(renderer: WebGLRenderer): void {
    const registry = this.layer.viewContext.postEffectRegistry;
    const maskRT = this.layer.postEffectResources.maskRT;

    // Render mask for Normal occlusion mode (depth-enabled objects)
    renderMaskForMode(
      renderer,
      this.layer.viewContext.camera,
      this.layer.viewContext.scenes,
      registry,
      PostEffectOcclusionMode.Normal,
      maskRT,
      "all",
    );
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    // Render mask
    this.renderMask(renderer);

    // Render debug visualization if enabled
    if (this.layer.layerConfig.testPostEffect?.debugMask) {
      this.layer.renderDebugMask();
    }

    // Copy input to output using CopyPass
    this.copyPass.renderToScreen = this.renderToScreen;
    this.copyPass.render(renderer, inputBuffer, outputBuffer);
  }

  dispose() {
    this.copyPass.dispose();
  }
}
