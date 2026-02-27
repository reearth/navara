import {
  Mesh,
  type OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
  RGBAFormat,
} from "three";

import type {
  EffectLayerConfig,
  EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import { SELECTIVE_BLOOM_EFFECT_KEY } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";
import { UnrealBloomPassRGBA } from "../../postprocessing";

import {
  SelectiveEffectLayer,
  createFullscreenQuad,
} from "./SelectiveEffectLayer";
import {
  SelectiveEffectPass,
  type SelectiveEffectProcessor,
} from "./SelectiveEffectPass";

// Selective Bloom configuration
export type SelectiveBloomEffectConfig = {
  selectiveEffect: true;
  selectiveBloom: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
    resolutionScale?: number;
    debugViews?: boolean;
  };
} & EffectLayerConfig;

export type SelectiveBloomEffectUpdate = {
  selectiveBloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
    resolutionScale?: number;
    debugViews?: boolean;
  };
} & EffectLayerUpdate;

// Default bloom parameters for mask-based selective bloom
const DEFAULT_STRENGTH = 0.8;
const DEFAULT_RADIUS = 0.2;
const DEFAULT_THRESHOLD = 0.0;

/**
 * Selective Bloom Effect Layer
 * Renders selective bloom using mask-based filtering.
 * Masks are pre-rendered by CustomRenderPass during BaseMRT phase.
 */
export class SelectiveBloomEffectLayer extends SelectiveEffectLayer<
  SelectiveBloomEffectConfig,
  SelectiveBloomEffectUpdate
> {
  static key = "selectiveBloom";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private effectPass?: SelectiveEffectPass;
  private bloomProcessor?: BloomProcessor;

  // Getters that derive values from config (single source of truth)
  get bloomStrength(): number {
    return this.config.selectiveBloom?.strength ?? DEFAULT_STRENGTH;
  }

  get bloomRadius(): number {
    return this.config.selectiveBloom?.radius ?? DEFAULT_RADIUS;
  }

  get bloomThreshold(): number {
    return this.config.selectiveBloom?.threshold ?? DEFAULT_THRESHOLD;
  }

  get debugMode(): number {
    return this.config.selectiveBloom?.debugMode ?? 0;
  }

  protected getEffectKey(): string {
    return SELECTIVE_BLOOM_EFFECT_KEY;
  }

  protected getResolutionScale(): number {
    return this.config.selectiveBloom?.resolutionScale ?? 1.0;
  }

  protected getDebugViews(): boolean {
    return this.config.selectiveBloom?.debugViews ?? false;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    const baseConfig = config as Partial<SelectiveBloomEffectConfig>;
    const bloomConfig =
      "selectiveBloom" in config ? baseConfig.selectiveBloom : undefined;

    const postEffectConfig: SelectiveBloomEffectConfig = {
      ...(config as SelectiveBloomEffectConfig),
      selectiveEffect: true,
      selectiveBloom: {
        strength: bloomConfig?.strength ?? DEFAULT_STRENGTH,
        radius: bloomConfig?.radius ?? DEFAULT_RADIUS,
        threshold: bloomConfig?.threshold ?? DEFAULT_THRESHOLD,
        debugMode: bloomConfig?.debugMode ?? 0,
        resolutionScale: bloomConfig?.resolutionScale ?? 1.0,
        debugViews: bloomConfig?.debugViews ?? false,
      },
    };

    super(view, postEffectConfig);
  }

  createPass() {
    const renderer =
      this.viewContext.renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale = this.getResolutionScale();
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    const processor = new BloomProcessor(
      initialWidth,
      initialHeight,
      this.bloomStrength,
      this.bloomRadius,
      this.bloomThreshold,
      this.debugMode,
    );
    this.bloomProcessor = processor;

    const debugViewsEnabled =
      this.getDebugViews() ||
      this.viewContext.debugOptions.selectiveEffectMask ||
      false;

    const rawPass = new SelectiveEffectPass(
      this,
      SELECTIVE_BLOOM_EFFECT_KEY,
      processor,
      { resolutionScale, debugViewsEnabled },
    );
    this.effectPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveEffectPass, null> & BaseInstance;
  }

  /**
   * Override: Don't register simple maskRT.
   * SelectiveEffectPass registers occlusion-specific RTs directly.
   */
  protected override registerMaskRenderTarget(): void {
    // Skip simple registration - SelectiveEffectPass handles occlusion-specific RTs
  }

  /**
   * Override: Unregister occlusion-specific RTs.
   */
  protected override unregisterMaskRenderTarget(): void {
    const customRenderPass = this.getCustomRenderPass();
    if (customRenderPass?.removeOcclusionMaskRenderTargets) {
      customRenderPass.removeOcclusionMaskRenderTargets(this.getEffectKey());
    }
  }

  onUpdateConfig(updates: SelectiveBloomEffectUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.selectiveBloom) {
      const next = updates.selectiveBloom;

      if (!this.config.selectiveBloom) {
        this.config.selectiveBloom = {};
      }

      // Update config only - getters will derive values from config
      if (next.strength !== undefined) {
        this.config.selectiveBloom.strength = next.strength;
      }

      if (next.radius !== undefined) {
        this.config.selectiveBloom.radius = next.radius;
      }

      if (next.threshold !== undefined) {
        this.config.selectiveBloom.threshold = next.threshold;
      }

      if (next.debugMode !== undefined) {
        this.config.selectiveBloom.debugMode = next.debugMode;
        this.bloomProcessor?.setDebugMode(next.debugMode);
      }

      if (next.debugViews !== undefined) {
        this.config.selectiveBloom.debugViews = next.debugViews;
        this.updateDebugViews(next.debugViews);
        this.effectPass?.updateDebugViews(
          next.debugViews ||
            this.viewContext.debugOptions.selectiveEffectMask ||
            false,
        );
      }

      if (next.resolutionScale !== undefined) {
        this.config.selectiveBloom.resolutionScale = next.resolutionScale;
        this.updateResolutionScale(next.resolutionScale);
        this.effectPass?.updateResolutionScale(next.resolutionScale);
      }

      this.bloomProcessor?.setParameters(
        this.bloomStrength,
        this.bloomRadius,
        this.bloomThreshold,
      );
    }
  }
}

// ============================================================
// BloomProcessor - implements SelectiveEffectProcessor
// ============================================================

class BloomProcessor implements SelectiveEffectProcessor {
  readonly depthEnabledResultRT: WebGLRenderTarget;
  readonly silhouetteResultRT: WebGLRenderTarget;

  private readonly bloom: UnrealBloomPassRGBA;
  private readonly compositeMaterial: ShaderMaterial;
  private readonly compositeScene: Scene;
  private readonly copyMaterial: ShaderMaterial;
  private readonly copyScene: Scene;
  private readonly fullscreenCamera: OrthographicCamera;
  private readonly fullscreenGeometry: PlaneGeometry;

  constructor(
    initialWidth: number,
    initialHeight: number,
    strength: number,
    radius: number,
    threshold: number,
    debugMode: number,
  ) {
    // Fullscreen rendering infrastructure
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Composite material to blend bloom with base scene
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tDepthEnabledBloom: { value: null },
        tSilhouetteBloom: { value: null },
        debugMode: { value: debugMode },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tBase;
        uniform sampler2D tDepthEnabledBloom;
        uniform sampler2D tSilhouetteBloom;
        uniform int debugMode;

        varying vec2 vUv;

        void main() {
          vec4 baseColor = texture2D(tBase, vUv);
          vec4 depthEnabledBloom = texture2D(tDepthEnabledBloom, vUv);
          vec4 silhouetteBloom = texture2D(tSilhouetteBloom, vUv);

          // Combine both bloom results
          vec3 totalBloom = depthEnabledBloom.rgb + silhouetteBloom.rgb;

          // Debug modes
          if (debugMode == 1) {
            // Show base only
            gl_FragColor = baseColor;
            return;
          } else if (debugMode == 2) {
            // Show bloom only (combined)
            gl_FragColor = vec4(totalBloom, 1.0);
            return;
          } else if (debugMode == 3) {
            // Show bloom enhanced (×100 for visibility)
            gl_FragColor = vec4(totalBloom * 100.0, 1.0);
            return;
          }

          // Simple additive blend
          gl_FragColor = vec4(baseColor.rgb + totalBloom, baseColor.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeScene = new Scene();
    this.compositeScene.add(
      new Mesh(this.fullscreenGeometry, this.compositeMaterial),
    );

    // Copy material for transferring bloom results between render targets
    this.copyMaterial = new ShaderMaterial({
      uniforms: {
        tSource: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tSource;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tSource, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.copyScene = new Scene();
    this.copyScene.add(new Mesh(this.fullscreenGeometry, this.copyMaterial));

    // Bloom result RTs
    this.depthEnabledResultRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.depthEnabledResultRT.texture.name =
      "SelectiveBloom_DepthEnabledResult";

    this.silhouetteResultRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.silhouetteResultRT.texture.name = "SelectiveBloom_SilhouetteResult";

    // UnrealBloomPass
    this.bloom = new UnrealBloomPassRGBA(
      new Vector2(initialWidth, initialHeight),
      strength,
      radius,
      threshold,
    );
    this.bloom.renderToScreen = false;
  }

  setParameters(strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  setDebugMode(mode: number): void {
    this.compositeMaterial.uniforms.debugMode.value = mode;
  }

  processEffect(
    renderer: WebGLRenderer,
    maskRT: WebGLRenderTarget,
    resultRT: WebGLRenderTarget,
    deltaTime: number,
  ): void {
    // Apply bloom (UnrealBloomPassRGBA uses readBuffer as input, ignores writeBuffer)
    this.bloom.render(renderer, resultRT, maskRT, deltaTime, false);

    // Copy bloom output to resultRT (bloom stores result in internal RT)
    const bloomOutput = this.bloom.renderTargetsHorizontal[0];
    if (bloomOutput) {
      this.copyMaterial.uniforms.tSource.value = bloomOutput.texture;
      renderer.setRenderTarget(resultRT);
      renderer.render(this.copyScene, this.fullscreenCamera);
    }
  }

  renderComposite(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tDepthEnabledBloom.value =
      this.depthEnabledResultRT.texture;
    this.compositeMaterial.uniforms.tSilhouetteBloom.value =
      this.silhouetteResultRT.texture;

    renderer.setRenderTarget(outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);
  }

  onResize(width: number, height: number): void {
    this.depthEnabledResultRT.setSize(width, height);
    this.silhouetteResultRT.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  dispose(): void {
    if (typeof this.bloom.dispose === "function") {
      this.bloom.dispose();
    }

    this.depthEnabledResultRT.dispose();
    this.silhouetteResultRT.dispose();

    this.fullscreenGeometry.dispose();
    this.compositeMaterial.dispose();
    this.copyMaterial.dispose();
  }
}
