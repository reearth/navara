/**
 * Debug-only / internal test layer for SelectiveEffect development.
 * Not intended for production use.
 */

import {
  Pass as PostProcessingPass,
  CopyPass as PostProcessingCopyPass,
} from "postprocessing";
import { type WebGLRenderer, type WebGLRenderTarget } from "three";

import type { BaseInstance } from "../../core/Declaration";
import type { EffectConfig } from "../../core/EffectDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  SelectiveEffectDeclaration,
  type SelectiveEffectDeclarationUpdate,
} from "./SelectiveEffectDeclaration";

// Test selective effect configuration (uses PostEffect infrastructure)
// Internal only - not exported as public API
type TestSelectiveEffectConfig = {
  selectiveEffect: true;
  _selectiveTest: {
    debugViews?: boolean;
    resolutionScale?: number;
  };
} & EffectConfig;

/**
 * Test layer for selective effect
 * Renders mask for debugging and passes through the input buffer
 */
export class TestSelectiveEffectDeclaration extends SelectiveEffectDeclaration<
  TestSelectiveEffectConfig,
  SelectiveEffectDeclarationUpdate
> {
  static key = "_selectiveTest";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  protected getEffectKey(): string {
    return TestSelectiveEffectDeclaration.key;
  }

  protected getResolutionScale(): number {
    return this.config._selectiveTest?.resolutionScale ?? 1.0;
  }

  protected getDebugViews(): boolean {
    return this.config._selectiveTest?.debugViews ?? false;
  }

  constructor(view: ViewContext, config: EffectConfig) {
    // Extract _selectiveTest config
    const selectiveTestConfig =
      "_selectiveTest" in config
        ? (config as TestSelectiveEffectConfig)._selectiveTest
        : {};

    // Ensure config has selectiveEffect: true and nested _selectiveTest config
    const postEffectConfig: TestSelectiveEffectConfig = {
      ...(config as TestSelectiveEffectConfig),
      selectiveEffect: true,
      _selectiveTest: {
        resolutionScale: selectiveTestConfig.resolutionScale ?? 1.0,
        debugViews: selectiveTestConfig.debugViews ?? false,
      },
    };

    super(view, postEffectConfig);
  }

  createPass() {
    // Create custom pass (follows SSAO pattern)
    const rawPass = new TestSelectivePass(this);
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<TestSelectivePass, null> & BaseInstance;
  }
}

/**
 * Custom PostProcessing Pass for TestPostEffect
 * Masks are pre-rendered by CustomRenderPass during BaseMRT phase
 */
class TestSelectivePass extends PostProcessingPass {
  private layer: TestSelectiveEffectDeclaration;
  private copyPass: PostProcessingCopyPass;

  constructor(layer: TestSelectiveEffectDeclaration) {
    super("TestSelectivePass");
    this.layer = layer;

    // Create CopyPass for copying input to output
    this.copyPass = new PostProcessingCopyPass();
    // This pass renders the debug mask and copies input to output, avoiding buffer swap.
    this.needsSwap = false;
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    // Mask is pre-rendered by CustomRenderPass during BaseMRT phase

    // Render debug visualization if enabled
    if (this.layer.layerConfig._selectiveTest?.debugViews) {
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
