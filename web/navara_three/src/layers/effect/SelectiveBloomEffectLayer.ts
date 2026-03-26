import { Pass as PostProcessingPass } from "postprocessing";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
  RGBAFormat,
  DepthTexture,
  UnsignedShortType,
} from "three";

import { BufferView } from "../../bufferView";
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
  type SelectiveEffectLayerConfig,
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./SelectiveEffectLayer";

// Selective Bloom configuration (flat structure)
export type SelectiveBloomEffectConfig = {
  selectiveBloom: true;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  bloomDebugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  bloomResolutionScale?: number;
  bloomDebugViews?: boolean;
} & SelectiveEffectLayerConfig;

export type SelectiveBloomEffectUpdate = {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  bloomDebugMode?: number;
  bloomResolutionScale?: number;
  bloomDebugViews?: boolean;
} & EffectLayerUpdate;

// Default bloom parameters for mask-based selective bloom
const DEFAULT_STRENGTH = 0.8;
const DEFAULT_RADIUS = 0.2;
const DEFAULT_THRESHOLD = 0.0;

/**
 * Selective Bloom Effect Layer
 * Renders selective bloom using mask-based filtering.
 * Masks are pre-rendered by CustomRenderPass during BaseMRT phase.
 *
 * @deprecated SE Redesign — Mask RT creation and MaskController registration
 * will be replaced by the new SE architecture. Bloom processing logic is retained.
 */
export class SelectiveBloomEffectLayer extends SelectiveEffectLayer<
  SelectiveBloomEffectConfig,
  SelectiveBloomEffectUpdate
> {
  static key = "selectiveBloom";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private bloomPass?: SelectiveBloomPass;

  // Getters that derive values from config (single source of truth)
  get bloomStrength(): number {
    return this.config.bloomStrength ?? DEFAULT_STRENGTH;
  }

  get bloomRadius(): number {
    return this.config.bloomRadius ?? DEFAULT_RADIUS;
  }

  get bloomThreshold(): number {
    return this.config.bloomThreshold ?? DEFAULT_THRESHOLD;
  }

  get debugMode(): number {
    return this.config.bloomDebugMode ?? 0;
  }

  protected getEffectKey(): string {
    return SELECTIVE_BLOOM_EFFECT_KEY;
  }

  protected getResolutionScale(): number {
    return this.config.bloomResolutionScale ?? 1.0;
  }

  protected getDebugViews(): boolean {
    return this.config.bloomDebugViews ?? false;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    const c = config as Partial<SelectiveBloomEffectConfig>;

    const postEffectConfig: SelectiveBloomEffectConfig = {
      ...(config as SelectiveBloomEffectConfig),
      selectiveEffect: true,
      selectiveBloom: true,
      bloomStrength: c.bloomStrength ?? DEFAULT_STRENGTH,
      bloomRadius: c.bloomRadius ?? DEFAULT_RADIUS,
      bloomThreshold: c.bloomThreshold ?? DEFAULT_THRESHOLD,
      bloomDebugMode: c.bloomDebugMode ?? 0,
      bloomResolutionScale: c.bloomResolutionScale ?? 1.0,
      bloomDebugViews: c.bloomDebugViews ?? false,
    };

    super(view, postEffectConfig);
  }

  createPass() {
    const rawPass = new SelectiveBloomPass(this);
    this.bloomPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveBloomPass, null> & BaseInstance;
  }

  /**
   * Override: Don't register simple maskRT.
   * SelectiveBloomPass registers occlusion-specific RTs directly.
   *
   * @deprecated SE Redesign — mask RT registration commented out.
   */
  protected override registerMaskRenderTarget(): void {
    // @deprecated SE Redesign — skip mask registration
  }

  /**
   * Override: Unregister occlusion-specific RTs.
   *
   * @deprecated SE Redesign — mask RT unregistration commented out.
   */
  protected override unregisterMaskRenderTarget(): void {
    // @deprecated SE Redesign — commented out occlusion mask RT unregistration
    // const customRenderPass = this.getCustomRenderPass();
    // if (customRenderPass?.removeOcclusionMaskRenderTargets) {
    //   customRenderPass.removeOcclusionMaskRenderTargets(this.getEffectKey());
    // }
  }

  onUpdateConfig(updates: SelectiveBloomEffectUpdate): void {
    super.onUpdateConfig(updates);

    let changed = false;

    if (updates.bloomStrength !== undefined) {
      this.config.bloomStrength = updates.bloomStrength;
      changed = true;
    }
    if (updates.bloomRadius !== undefined) {
      this.config.bloomRadius = updates.bloomRadius;
      changed = true;
    }
    if (updates.bloomThreshold !== undefined) {
      this.config.bloomThreshold = updates.bloomThreshold;
      changed = true;
    }
    if (updates.bloomDebugMode !== undefined) {
      this.config.bloomDebugMode = updates.bloomDebugMode;
    }
    if (updates.bloomDebugViews !== undefined) {
      this.config.bloomDebugViews = updates.bloomDebugViews;
      this.updateDebugViews(updates.bloomDebugViews);
    }
    if (updates.bloomResolutionScale !== undefined) {
      this.config.bloomResolutionScale = updates.bloomResolutionScale;
      this.updateResolutionScale(updates.bloomResolutionScale);
    }

    if (changed) {
      this.bloomPass?.setParameters(
        this.bloomStrength,
        this.bloomRadius,
        this.bloomThreshold,
      );
    }
  }
}

/**
 * Custom PostProcessing Pass for PostEffect Bloom
 * Renders only objects with Bloom effect enabled
 */
class SelectiveBloomPass extends PostProcessingPass {
  private layer: SelectiveBloomEffectLayer;
  private bloom: UnrealBloomPassRGBA;

  // DepthEnabled pass render targets
  private depthEnabledMaskRT: WebGLRenderTarget;
  private depthClipRT: WebGLRenderTarget;
  private depthClipMaterial: ShaderMaterial;
  private depthClipScene: Scene;

  // Silhouette pass render target (no depth clip)
  private silhouetteMaskRT: WebGLRenderTarget;

  // Intermediate bloom results
  private depthEnabledBloomRT: WebGLRenderTarget;
  private silhouetteBloomRT: WebGLRenderTarget;

  // Copy material for transferring bloom results
  private copyMaterial: ShaderMaterial;
  private copyScene: Scene;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  // Debug views
  private debugView1?: BufferView;
  private debugView2?: BufferView;

  constructor(layer: SelectiveBloomEffectLayer) {
    super("SelectiveBloomPass");
    this.layer = layer;

    const renderer =
      layer.viewContext.renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale = layer.layerConfig.bloomResolutionScale ?? 1.0;
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    // Create shared fullscreen rendering infrastructure
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Composite material to blend bloom with base scene
    // Blends two bloom results: DepthEnabled + Silhouette
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tDepthEnabledBloom: { value: null },
        tSilhouetteBloom: { value: null },
        debugMode: { value: 0 },
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
    const compositeQuad = new Mesh(
      this.fullscreenGeometry,
      this.compositeMaterial,
    );
    this.compositeScene.add(compositeQuad);

    // Depth clip material: clips mask by Base depth before blur (shared implementation)
    this.depthClipMaterial = createDepthClipMaterial();

    this.depthClipScene = new Scene();
    const depthClipQuad = new Mesh(
      this.fullscreenGeometry,
      this.depthClipMaterial,
    );
    this.depthClipScene.add(depthClipQuad);

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
    const copyQuad = new Mesh(this.fullscreenGeometry, this.copyMaterial);
    this.copyScene.add(copyQuad);

    // @deprecated SE Redesign — Mask RT creation commented out.
    // These render targets were used for mask-based selective rendering
    // via CustomRenderPass during BaseMRT phase.
    // Render target for DepthEnabled mask with depth texture
    this.depthEnabledMaskRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: true,
      },
    );
    this.depthEnabledMaskRT.texture.name = `SelectiveEffectMask_selectiveBloom_DepthEnabled_${layer.id}`;
    this.depthEnabledMaskRT.depthTexture = new DepthTexture(
      initialWidth,
      initialHeight,
      UnsignedShortType,
    );

    // Render target for depth-clipped mask (no depth buffer needed)
    this.depthClipRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.depthClipRT.texture.name = `SelectiveBloom_DepthClip_${layer.id}`;

    // Render target for Silhouette mask (no depth clip needed)
    this.silhouetteMaskRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.silhouetteMaskRT.texture.name = `SelectiveEffectMask_selectiveBloom_Silhouette_${layer.id}`;

    // Intermediate bloom result render targets
    this.depthEnabledBloomRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.depthEnabledBloomRT.texture.name = `SelectiveBloom_DepthEnabledResult_${layer.id}`;

    this.silhouetteBloomRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.silhouetteBloomRT.texture.name = `SelectiveBloom_SilhouetteResult_${layer.id}`;

    this.bloom = new UnrealBloomPassRGBA(
      new Vector2(initialWidth, initialHeight),
      layer.bloomStrength,
      layer.bloomRadius,
      layer.bloomThreshold,
    );
    this.bloom.renderToScreen = false;

    this.size.set(initialWidth, initialHeight);

    // @deprecated SE Redesign — commented out occlusion mask RT registration with CustomRenderPass.
    // const customRenderPass = layer.getCustomRenderPass();
    // if (customRenderPass?.setOcclusionMaskRenderTargets) {
    //   customRenderPass.setOcclusionMaskRenderTargets(
    //     SELECTIVE_BLOOM_EFFECT_KEY,
    //     {
    //       normal: this.depthEnabledMaskRT,
    //       silhouette: this.silhouetteMaskRT,
    //     },
    //   );
    // }

    this.needsSwap = true;
  }

  setParameters(strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  private updateSizes(width: number, height: number): void {
    if (this.size.x === width && this.size.y === height) {
      return;
    }

    this.size.set(width, height);

    // DepthEnabled mask RT
    this.depthEnabledMaskRT.setSize(width, height);
    if (this.depthEnabledMaskRT.depthTexture) {
      this.depthEnabledMaskRT.depthTexture.dispose();
      this.depthEnabledMaskRT.depthTexture = new DepthTexture(
        width,
        height,
        UnsignedShortType,
      );
    }

    // Depth clip RT
    this.depthClipRT.setSize(width, height);

    // Silhouette mask RT
    this.silhouetteMaskRT.setSize(width, height);

    // Bloom result RTs
    this.depthEnabledBloomRT.setSize(width, height);
    this.silhouetteBloomRT.setSize(width, height);

    this.bloom.setSize(width, height);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
  ): void {
    // Step 1: Update sizes
    this.updateSizes(inputBuffer.width, inputBuffer.height);

    // Set bloom parameters
    this.setParameters(
      this.layer.bloomStrength,
      this.layer.bloomRadius,
      this.layer.bloomThreshold,
    );

    // Get bloom output helper
    const getBloomOutput = (): WebGLRenderTarget | undefined => {
      return this.bloom.renderTargetsHorizontal[0];
    };

    // ========================================
    // Pass 1: DepthEnabled objects (with depth clip)
    // ========================================
    // Mask is pre-rendered by CustomRenderPass during BaseMRT phase

    // Apply depth clip to DepthEnabled mask (shared implementation)
    applyDepthClip(
      renderer,
      this.depthClipMaterial,
      this.depthClipScene,
      this.fullscreenCamera,
      this.depthEnabledMaskRT,
      this.layer.getBaseDepthTexture(),
      this.depthClipRT,
    );

    // Step 4a: Apply Bloom to depth-clipped mask
    // Note: UnrealBloomPassRGBA ignores writeBuffer and uses readBuffer as input
    this.bloom.render(
      renderer,
      this.depthEnabledBloomRT, // writeBuffer (ignored by UnrealBloomPassRGBA)
      this.depthClipRT, // readBuffer (actual input)
      deltaTime ?? 0,
      false,
    );

    // Copy bloom result to depthEnabledBloomRT
    const depthEnabledBloomOutput = getBloomOutput();
    if (depthEnabledBloomOutput) {
      // Copy from bloom internal RT to our result RT
      this.copyTexture(
        renderer,
        depthEnabledBloomOutput,
        this.depthEnabledBloomRT,
      );
    }

    // ========================================
    // Pass 2: Silhouette objects (no depth clip)
    // ========================================
    // Mask is pre-rendered by CustomRenderPass during BaseMRT phase

    // Apply Bloom directly (no depth clip)
    // Note: UnrealBloomPassRGBA ignores writeBuffer and uses readBuffer as input
    this.bloom.render(
      renderer,
      this.silhouetteBloomRT, // writeBuffer (ignored by UnrealBloomPassRGBA)
      this.silhouetteMaskRT, // readBuffer (actual input)
      deltaTime ?? 0,
      false,
    );

    // Copy bloom result to silhouetteBloomRT
    const silhouetteBloomOutput = getBloomOutput();
    if (silhouetteBloomOutput) {
      this.copyTexture(renderer, silhouetteBloomOutput, this.silhouetteBloomRT);
    }

    // ========================================
    // Step 5: Composite both bloom results
    // ========================================
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tDepthEnabledBloom.value =
      this.depthEnabledBloomRT.texture;
    this.compositeMaterial.uniforms.tSilhouetteBloom.value =
      this.silhouetteBloomRT.texture;
    this.compositeMaterial.uniforms.debugMode.value = this.layer.debugMode;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);

    // Optional debug views
    if (this.layer.layerConfig.bloomDebugViews) {
      if (!this.debugView1) {
        this.debugView1 = new BufferView(
          this.depthEnabledMaskRT.width,
          this.depthEnabledMaskRT.height,
        );
      }

      if (!this.debugView2) {
        this.debugView2 = new BufferView(
          this.silhouetteMaskRT.width,
          this.silhouetteMaskRT.height,
        );
      }

      this.debugView1.render(renderer, this.depthEnabledMaskRT);
      this.debugView2.render(renderer, this.silhouetteMaskRT);
    } else {
      // Dispose debug views when debugViews is disabled
      if (this.debugView1) {
        this.debugView1.dispose();
        this.debugView1 = undefined;
      }
      if (this.debugView2) {
        this.debugView2.dispose();
        this.debugView2 = undefined;
      }
    }
  }

  /**
   * Copy texture from source RT to destination RT using copy shader
   */
  private copyTexture(
    renderer: WebGLRenderer,
    source: WebGLRenderTarget,
    dest: WebGLRenderTarget,
  ): void {
    this.copyMaterial.uniforms.tSource.value = source.texture;
    renderer.setRenderTarget(dest);
    renderer.render(this.copyScene, this.fullscreenCamera);
  }

  dispose(): void {
    if (typeof this.bloom.dispose === "function") {
      this.bloom.dispose();
    }

    // DepthEnabled mask RT
    this.depthEnabledMaskRT.depthTexture?.dispose();
    this.depthEnabledMaskRT.dispose();

    // Depth clip RT
    this.depthClipRT.dispose();

    // Silhouette mask RT
    this.silhouetteMaskRT.dispose();

    // Bloom result RTs
    this.depthEnabledBloomRT.dispose();
    this.silhouetteBloomRT.dispose();

    // Materials and geometry
    this.fullscreenGeometry.dispose();
    this.compositeMaterial.dispose();
    this.depthClipMaterial.dispose();
    this.copyMaterial.dispose();

    // Debug views
    this.debugView1?.dispose();
    this.debugView2?.dispose();
  }
}
