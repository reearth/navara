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
  SelectiveEffectLayerBase,
  type SelectiveEffectConfig,
  type SelectiveEffectUpdate,
} from "./SelectiveEffectLayer";

// Test selective effect configuration
export type TestSelectiveConfig = {
  testSelective: {
    debugMask?: boolean;
    resolutionScale?: number;
  };
} & EffectLayerConfig;

/**
 * Test layer for selective effect
 * Renders mask for debugging and passes through the input buffer
 */
export class TestSelectiveEffectLayer extends SelectiveEffectLayerBase<
  SelectiveEffectConfig,
  SelectiveEffectUpdate
> {
  static key = "testSelective";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  constructor(view: ViewContext, config: EffectLayerConfig) {
    // Extract testSelective config
    const testSelectiveConfig =
      "testSelective" in config ? (config as any).testSelective : {};

    // Ensure config has selective: true
    const selectiveConfig: SelectiveEffectConfig = {
      ...config,
      selective: true,
      resolutionScale: testSelectiveConfig.resolutionScale ?? 1.0,
      debugMask: testSelectiveConfig.debugMask ?? false,
    };

    super(view, selectiveConfig);
  }

  createPass() {
    // Create custom pass (follows SSAO pattern)
    const rawPass = new TestSelectivePass(this);
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<TestSelectivePass, null> & BaseInstance;
  }
}

/**
 * Custom PostProcessing Pass for TestSelectiveEffect
 * Defined after TestSelectiveEffectLayer to access protected members
 */
class TestSelectivePass extends PostProcessingPass {
  private layer: TestSelectiveEffectLayer;
  private copyPass: PostProcessingCopyPass;

  constructor(layer: TestSelectiveEffectLayer) {
    super("TestSelectivePass");
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
