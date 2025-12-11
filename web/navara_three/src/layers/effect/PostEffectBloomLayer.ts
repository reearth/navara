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
import {
  hasBloomEffect,
  PostEffectOcclusionMode,
} from "../../core/PostEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";
import { UnrealBloomPassRGBA } from "../../postprocessing";

import {
  PostEffectLayer,
  renderMaskForMode,
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./PostEffectLayer";

// PostEffect Bloom configuration
export type PostEffectBloomConfig = {
  postEffect: true;
  postEffectBloom: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerConfig;

export type PostEffectBloomUpdate = {
  postEffectBloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
  };
  resolutionScale?: number;
  debugMask?: boolean;
} & EffectLayerUpdate;

// Reduced defaults for tighter bloom closer to old look
const DEFAULT_STRENGTH = 0.8; // 1.5 → 0.8 (47% reduction)
const DEFAULT_RADIUS = 0.2; // 0.4 → 0.2 (50% reduction)
const DEFAULT_THRESHOLD = 0.0; // 0.85 → 0.0 (mask-based bloom, no threshold needed)

/**
 * Post Effect Bloom Layer
 * Uses scene.traverse() instead of clone scenes for better performance and maintainability
 */
export class PostEffectBloomLayer extends PostEffectLayer<
  PostEffectBloomConfig,
  PostEffectBloomUpdate
> {
  static key = "postEffectBloom";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  public bloomStrength: number;
  public bloomRadius: number;
  public bloomThreshold: number;
  public debugMode: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced

  private bloomPass?: PostEffectBloomPass;

  protected getEffectKey(): string {
    return PostEffectBloomLayer.key;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    const baseConfig = config as Partial<PostEffectBloomConfig>;
    const postEffectBloomConfig =
      "postEffectBloom" in config ? baseConfig.postEffectBloom : undefined;

    const postEffectConfig: PostEffectBloomConfig = {
      ...(config as PostEffectBloomConfig),
      postEffect: true,
      resolutionScale: baseConfig.resolutionScale ?? 1.0,
      debugMask: baseConfig.debugMask ?? false,
      postEffectBloom: {
        strength: postEffectBloomConfig?.strength ?? DEFAULT_STRENGTH,
        radius: postEffectBloomConfig?.radius ?? DEFAULT_RADIUS,
        threshold: postEffectBloomConfig?.threshold ?? DEFAULT_THRESHOLD,
      },
    };

    super(view, postEffectConfig);

    this.bloomStrength =
      this.config.postEffectBloom?.strength ?? DEFAULT_STRENGTH;
    this.bloomRadius = this.config.postEffectBloom?.radius ?? DEFAULT_RADIUS;
    this.bloomThreshold =
      this.config.postEffectBloom?.threshold ?? DEFAULT_THRESHOLD;
    this.debugMode = this.config.postEffectBloom?.debugMode ?? 0;
  }

  createPass() {
    const rawPass = new PostEffectBloomPass(this);
    this.bloomPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<PostEffectBloomPass, null> & BaseInstance;
  }

  onUpdateConfig(updates: PostEffectBloomUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.postEffectBloom) {
      const next = updates.postEffectBloom;

      if (!this.config.postEffectBloom) {
        this.config.postEffectBloom = {};
      }

      if (next.strength !== undefined) {
        this.bloomStrength = next.strength;
        this.config.postEffectBloom.strength = next.strength;
      }

      if (next.radius !== undefined) {
        this.bloomRadius = next.radius;
        this.config.postEffectBloom.radius = next.radius;
      }

      if (next.threshold !== undefined) {
        this.bloomThreshold = next.threshold;
        this.config.postEffectBloom.threshold = next.threshold;
      }

      if (next.debugMode !== undefined) {
        this.debugMode = next.debugMode;
        this.config.postEffectBloom.debugMode = next.debugMode;
      }

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
 * Instead of using clone scenes, directly traverses the main scene
 * and renders only objects with Bloom effect enabled
 */
class PostEffectBloomPass extends PostProcessingPass {
  private layer: PostEffectBloomLayer;
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

  constructor(layer: PostEffectBloomLayer) {
    super("PostEffectBloomPass");
    this.layer = layer;

    const renderer =
      layer["view"].renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale = layer["config"].resolutionScale ?? 1.0;
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
        bloomIntensity: { value: 1.0 },
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
        uniform float bloomIntensity;
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
          vec3 finalBloom = totalBloom * bloomIntensity;
          gl_FragColor = vec4(baseColor.rgb + finalBloom, baseColor.a);
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
    this.depthEnabledMaskRT.texture.name = `PostEffectMask_postEffectBloom_DepthEnabled_${layer.id}`;
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
    this.depthClipRT.texture.name = `PostEffectBloom_DepthClip_${layer.id}`;

    // Render target for Silhouette mask (no depth clip needed)
    this.silhouetteMaskRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.silhouetteMaskRT.texture.name = `PostEffectMask_postEffectBloom_Silhouette_${layer.id}`;

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
    this.depthEnabledBloomRT.texture.name = `PostEffectBloom_DepthEnabledResult_${layer.id}`;

    this.silhouetteBloomRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.silhouetteBloomRT.texture.name = `PostEffectBloom_SilhouetteResult_${layer.id}`;

    this.bloom = new UnrealBloomPassRGBA(
      new Vector2(initialWidth, initialHeight),
      layer.bloomStrength,
      layer.bloomRadius,
      layer.bloomThreshold,
    );
    this.bloom.renderToScreen = false;

    this.size.set(initialWidth, initialHeight);

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

  /**
   * Render Bloom mask for a specific occlusion mode
   * Uses shared renderMaskForMode implementation
   */
  private renderBloomMaskForMode(
    renderer: WebGLRenderer,
    targetMode: number,
    targetRT: WebGLRenderTarget,
  ): void {
    renderMaskForMode(
      renderer,
      this.layer["view"].camera,
      this.layer["view"].scenes,
      this.layer["view"].postEffectRegistry,
      targetMode,
      targetRT,
      hasBloomEffect,
    );
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
    const getBloomOutput = () => {
      const bloomInternals = this.bloom as unknown as {
        renderTargetsHorizontal?: WebGLRenderTarget[];
      };
      return bloomInternals.renderTargetsHorizontal?.[0];
    };

    // ========================================
    // Pass 1: DepthEnabled objects (with depth clip)
    // ========================================

    // Step 2a: Render DepthEnabled mask
    this.renderBloomMaskForMode(
      renderer,
      PostEffectOcclusionMode.Normal,
      this.depthEnabledMaskRT,
    );

    // Step 3a: Apply depth clip to DepthEnabled mask (shared implementation)
    applyDepthClip(
      renderer,
      this.depthClipMaterial,
      this.depthClipScene,
      this.fullscreenCamera,
      this.depthEnabledMaskRT,
      this.layer["getBaseDepthTexture"](),
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

    // Step 2b: Render Silhouette mask
    this.renderBloomMaskForMode(
      renderer,
      PostEffectOcclusionMode.Silhouette,
      this.silhouetteMaskRT,
    );

    // Step 4b: Apply Bloom directly (no depth clip)
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
    this.compositeMaterial.uniforms.bloomIntensity.value = 1.0;
    this.compositeMaterial.uniforms.debugMode.value = this.layer.debugMode;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);

    // Optional debug views
    if (this.layer["config"].debugMask) {
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
