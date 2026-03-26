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
import { Color } from "../../Color";
import type {
  EffectLayerConfig,
  EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import { SELECTIVE_OUTLINE_EFFECT_KEY } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  SelectiveEffectLayer,
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./SelectiveEffectLayer";

// Selective Outline configuration
export type SelectiveOutlineEffectConfig = {
  selectiveEffect: true;
  selectiveOutline: {
    color?: Color;
    thickness?: number;
    edgeStrength?: number;
    resolutionScale?: number;
    debugViews?: boolean;
  };
} & EffectLayerConfig;

export type SelectiveOutlineEffectUpdate = {
  selectiveOutline?: {
    color?: Color;
    thickness?: number;
    edgeStrength?: number;
    resolutionScale?: number;
    debugViews?: boolean;
  };
} & EffectLayerUpdate;

const DEFAULT_COLOR = 0xffffff;
const DEFAULT_THICKNESS = 1.0;
const DEFAULT_EDGE_STRENGTH = 1.0;

/**
 * Selective Outline Effect Layer
 * Renders selective outline using mask-based filtering.
 * Masks are pre-rendered by CustomRenderPass during BaseMRT phase.
 *
 * @deprecated SE Redesign — Mask RT creation and MaskController registration
 * will be replaced by the new SE architecture. Outline processing logic (Sobel edge detection) is retained.
 */
export class SelectiveOutlineEffectLayer extends SelectiveEffectLayer<
  SelectiveOutlineEffectConfig,
  SelectiveOutlineEffectUpdate
> {
  static key = "selectiveOutline";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private outlinePass?: SelectiveOutlinePass;

  // Getters that derive values from config (single source of truth)
  get outlineColor(): Color {
    const color = this.config.selectiveOutline?.color;
    return color instanceof Color ? color : new Color().setHex(DEFAULT_COLOR);
  }

  get outlineThickness(): number {
    return this.config.selectiveOutline?.thickness ?? DEFAULT_THICKNESS;
  }

  get outlineEdgeStrength(): number {
    return this.config.selectiveOutline?.edgeStrength ?? DEFAULT_EDGE_STRENGTH;
  }

  protected getEffectKey(): string {
    return SELECTIVE_OUTLINE_EFFECT_KEY;
  }

  protected getResolutionScale(): number {
    return this.config.selectiveOutline?.resolutionScale ?? 1.0;
  }

  protected getDebugViews(): boolean {
    return this.config.selectiveOutline?.debugViews ?? false;
  }

  constructor(view: ViewContext, config: EffectLayerConfig) {
    const baseConfig = config as Partial<SelectiveOutlineEffectConfig>;
    const outlineConfig =
      "selectiveOutline" in config ? baseConfig.selectiveOutline : undefined;

    const postEffectConfig: SelectiveOutlineEffectConfig = {
      ...(config as SelectiveOutlineEffectConfig),
      selectiveEffect: true,
      selectiveOutline: {
        color: outlineConfig?.color ?? new Color().setHex(DEFAULT_COLOR),
        thickness: outlineConfig?.thickness ?? DEFAULT_THICKNESS,
        edgeStrength: outlineConfig?.edgeStrength ?? DEFAULT_EDGE_STRENGTH,
        resolutionScale: outlineConfig?.resolutionScale ?? 1.0,
        debugViews: outlineConfig?.debugViews ?? false,
      },
    };

    super(view, postEffectConfig);
  }

  createPass() {
    const rawPass = new SelectiveOutlinePass(this);
    this.outlinePass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveOutlinePass, null> & BaseInstance;
  }

  /**
   * Override: Don't register simple maskRT.
   * SelectiveOutlinePass registers occlusion-specific RTs directly.
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

  onUpdateConfig(updates: SelectiveOutlineEffectUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.selectiveOutline) {
      const next = updates.selectiveOutline;

      if (!this.config.selectiveOutline) {
        this.config.selectiveOutline = {};
      }

      // Update config only - getters will derive values from config
      if (next.color !== undefined) {
        this.config.selectiveOutline.color = next.color;
      }

      if (next.thickness !== undefined) {
        this.config.selectiveOutline.thickness = next.thickness;
      }

      if (next.edgeStrength !== undefined) {
        this.config.selectiveOutline.edgeStrength = next.edgeStrength;
      }

      if (next.debugViews !== undefined) {
        this.config.selectiveOutline.debugViews = next.debugViews;
        this.updateDebugViews(next.debugViews);
      }

      if (next.resolutionScale !== undefined) {
        this.config.selectiveOutline.resolutionScale = next.resolutionScale;
        this.updateResolutionScale(next.resolutionScale);
      }

      this.outlinePass?.setParameters(
        this.outlineColor,
        this.outlineThickness,
        this.outlineEdgeStrength,
      );
    }
  }
}

/**
 * Custom PostProcessing Pass for PostEffect Outline
 * Implements pass separation for per-object occlusion handling
 */
class SelectiveOutlinePass extends PostProcessingPass {
  private layer: SelectiveOutlineEffectLayer;

  // Pass separation: separate render targets for DepthEnabled and Silhouette
  private depthEnabledMaskRT: WebGLRenderTarget;
  private silhouetteMaskRT: WebGLRenderTarget;
  private depthEnabledEdgeRT: WebGLRenderTarget;
  private silhouetteEdgeRT: WebGLRenderTarget;

  // Depth clip pass: clips mask by Base depth (DepthEnabled only)
  private depthClipRT: WebGLRenderTarget;
  private depthClipMaterial: ShaderMaterial;
  private depthClipScene: Scene;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private edgeDetectScene: Scene;
  private edgeDetectMaterial: ShaderMaterial;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  // Debug views
  private debugView1?: BufferView;
  private debugView2?: BufferView;

  constructor(layer: SelectiveOutlineEffectLayer) {
    super("SelectiveOutlinePass");
    this.layer = layer;

    const renderer =
      layer.viewContext.renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale =
      layer.layerConfig.selectiveOutline?.resolutionScale ?? 1.0;
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    // Create shared fullscreen rendering infrastructure
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Edge detection material (Sobel filter)
    this.edgeDetectMaterial = new ShaderMaterial({
      uniforms: {
        tMask: { value: null },
        resolution: { value: new Vector2(initialWidth, initialHeight) },
        edgeStrength: { value: 1.0 },
        thickness: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tMask;
        uniform vec2 resolution;
        uniform float edgeStrength;
        uniform float thickness;

        varying vec2 vUv;

        // RGB-based mask sampling (aligned with Bloom approach)
        // - Mask presence is determined by RGB brightness (white=mask, black=no mask)
        float sampleMask(vec2 uv) {
          vec3 rgb = texture2D(tMask, uv).rgb;
          return length(rgb) > 0.1 ? 1.0 : 0.0;
        }

        void main() {
          vec2 texel = 1.0 / resolution;
          vec2 offset = texel * thickness;  // Scale sample interval by thickness

          // Sobel kernel with thickness-based offset
          float tl = sampleMask(vUv + offset * vec2(-1.0,  1.0));
          float t  = sampleMask(vUv + offset * vec2( 0.0,  1.0));
          float tr = sampleMask(vUv + offset * vec2( 1.0,  1.0));
          float l  = sampleMask(vUv + offset * vec2(-1.0,  0.0));
          float r  = sampleMask(vUv + offset * vec2( 1.0,  0.0));
          float bl = sampleMask(vUv + offset * vec2(-1.0, -1.0));
          float b  = sampleMask(vUv + offset * vec2( 0.0, -1.0));
          float br = sampleMask(vUv + offset * vec2( 1.0, -1.0));

          // Sobel operator
          float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
          float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

          float edge = length(vec2(gx, gy)) * edgeStrength;
          edge = clamp(edge, 0.0, 1.0);

          gl_FragColor = vec4(vec3(edge), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.edgeDetectScene = new Scene();
    const edgeQuad = new Mesh(this.fullscreenGeometry, this.edgeDetectMaterial);
    this.edgeDetectScene.add(edgeQuad);

    // Depth clip material: clips mask by Base depth (shared implementation)
    this.depthClipMaterial = createDepthClipMaterial();

    this.depthClipScene = new Scene();
    const depthClipQuad = new Mesh(
      this.fullscreenGeometry,
      this.depthClipMaterial,
    );
    this.depthClipScene.add(depthClipQuad);

    // Composite material to blend outline with base scene
    // Blends two edge results: DepthEnabled + Silhouette
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tDepthEnabledEdge: { value: null },
        tSilhouetteEdge: { value: null },
        outlineColor: { value: new Color().setHex(0xffffff).raw },
        thickness: { value: 1.0 },
        resolution: { value: new Vector2(initialWidth, initialHeight) },
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
        uniform sampler2D tDepthEnabledEdge;
        uniform sampler2D tSilhouetteEdge;
        uniform vec3 outlineColor;
        uniform float thickness;
        uniform vec2 resolution;

        varying vec2 vUv;

        float sampleEdge(sampler2D tEdge, vec2 uv, vec2 texel, float thickness) {
          float edgeCenter = texture2D(tEdge, uv).r;
          float edgeHPos = texture2D(tEdge, uv + texel * vec2(thickness, 0.0)).r;
          float edgeHNeg = texture2D(tEdge, uv + texel * vec2(-thickness, 0.0)).r;
          float edgeVPos = texture2D(tEdge, uv + texel * vec2(0.0, thickness)).r;
          float edgeVNeg = texture2D(tEdge, uv + texel * vec2(0.0, -thickness)).r;
          return max(edgeCenter, max(max(edgeHPos, edgeHNeg), max(edgeVPos, edgeVNeg)));
        }

        void main() {
          vec4 baseColor = texture2D(tBase, vUv);
          vec2 texel = 1.0 / resolution;

          // Sample both edge results with thickness-based dilation
          float depthEnabledEdge = sampleEdge(tDepthEnabledEdge, vUv, texel, thickness);
          float silhouetteEdge = sampleEdge(tSilhouetteEdge, vUv, texel, thickness);

          // Combine edges (max blend)
          float totalEdge = clamp(max(depthEnabledEdge, silhouetteEdge), 0.0, 1.0);

          // Blend outline with base
          vec3 finalColor = mix(baseColor.rgb, outlineColor, totalEdge);
          gl_FragColor = vec4(finalColor, baseColor.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    // Initialize uniforms from layer configuration
    this.setParameters(
      layer.outlineColor,
      layer.outlineThickness,
      layer.outlineEdgeStrength,
    );

    this.compositeScene = new Scene();
    const compositeQuad = new Mesh(
      this.fullscreenGeometry,
      this.compositeMaterial,
    );
    this.compositeScene.add(compositeQuad);

    // @deprecated SE Redesign — Mask RT creation commented out.
    // These render targets were used for mask-based selective rendering
    // via CustomRenderPass during BaseMRT phase.

    // DepthEnabled mask with accessible depth texture (for depth clip)
    this.depthEnabledMaskRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: true,
      },
    );
    this.depthEnabledMaskRT.texture.name = `SelectiveEffectMask_selectiveOutline_DepthEnabled_${layer.id}`;
    this.depthEnabledMaskRT.depthTexture = new DepthTexture(
      initialWidth,
      initialHeight,
      UnsignedShortType,
    );

    // Silhouette mask (no depth texture needed - no depth clip for silhouette)
    this.silhouetteMaskRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.silhouetteMaskRT.texture.name = `SelectiveEffectMask_selectiveOutline_Silhouette_${layer.id}`;

    // DepthEnabled edge detection result
    this.depthEnabledEdgeRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.depthEnabledEdgeRT.texture.name = `SelectiveOutline_DepthEnabledEdge_${layer.id}`;

    // Silhouette edge detection result
    this.silhouetteEdgeRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.silhouetteEdgeRT.texture.name = `SelectiveOutline_SilhouetteEdge_${layer.id}`;

    // Render target for depth-clipped mask (DepthEnabled only)
    this.depthClipRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.depthClipRT.texture.name = `SelectiveOutline_DepthClip_${layer.id}`;

    this.size.set(initialWidth, initialHeight);

    // @deprecated SE Redesign — commented out occlusion mask RT registration with CustomRenderPass.
    // const customRenderPass = layer.getCustomRenderPass();
    // if (customRenderPass?.setOcclusionMaskRenderTargets) {
    //   customRenderPass.setOcclusionMaskRenderTargets(
    //     SELECTIVE_OUTLINE_EFFECT_KEY,
    //     {
    //       normal: this.depthEnabledMaskRT,
    //       silhouette: this.silhouetteMaskRT,
    //     },
    //   );
    // }

    this.needsSwap = true;
  }

  setParameters(color: Color, thickness: number, edgeStrength: number): void {
    this.compositeMaterial.uniforms.outlineColor.value.copy(color.raw);
    this.compositeMaterial.uniforms.thickness.value = thickness;
    this.edgeDetectMaterial.uniforms.edgeStrength.value = edgeStrength;
    this.edgeDetectMaterial.uniforms.thickness.value = thickness;
  }

  private updateSizes(width: number, height: number): void {
    if (this.size.x === width && this.size.y === height) {
      return;
    }

    this.size.set(width, height);

    // Update all render targets
    this.depthEnabledMaskRT.setSize(width, height);
    if (this.depthEnabledMaskRT.depthTexture) {
      this.depthEnabledMaskRT.depthTexture.dispose();
      this.depthEnabledMaskRT.depthTexture = new DepthTexture(
        width,
        height,
        UnsignedShortType,
      );
    }

    this.silhouetteMaskRT.setSize(width, height);
    this.depthEnabledEdgeRT.setSize(width, height);
    this.silhouetteEdgeRT.setSize(width, height);
    this.depthClipRT.setSize(width, height);

    this.edgeDetectMaterial.uniforms.resolution.value.set(width, height);
    this.compositeMaterial.uniforms.resolution.value.set(width, height);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    _deltaTime?: number,
  ): void {
    // Step 1: Update sizes
    this.updateSizes(inputBuffer.width, inputBuffer.height);

    // ============================================
    // Pass 1: DepthEnabled objects (with depth clip)
    // ============================================
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

    // Step 4a: Apply edge detection (Sobel filter) to depth-clipped mask
    this.edgeDetectMaterial.uniforms.tMask.value = this.depthClipRT.texture;
    renderer.setRenderTarget(this.depthEnabledEdgeRT);
    renderer.render(this.edgeDetectScene, this.fullscreenCamera);

    // ============================================
    // Pass 2: Silhouette objects (no depth clip)
    // ============================================
    // Mask is pre-rendered by CustomRenderPass during BaseMRT phase

    // Apply edge detection directly (no depth clip for Silhouette)
    this.edgeDetectMaterial.uniforms.tMask.value =
      this.silhouetteMaskRT.texture;
    renderer.setRenderTarget(this.silhouetteEdgeRT);
    renderer.render(this.edgeDetectScene, this.fullscreenCamera);

    // ============================================
    // Step 5: Composite both edge results
    // ============================================
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tDepthEnabledEdge.value =
      this.depthEnabledEdgeRT.texture;
    this.compositeMaterial.uniforms.tSilhouetteEdge.value =
      this.silhouetteEdgeRT.texture;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);

    // Optional debug views
    if (this.layer.layerConfig.selectiveOutline?.debugViews) {
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

  dispose(): void {
    // Dispose all render targets
    this.depthEnabledMaskRT.depthTexture?.dispose();
    this.depthEnabledMaskRT.dispose();
    this.silhouetteMaskRT.dispose();
    this.depthEnabledEdgeRT.dispose();
    this.silhouetteEdgeRT.dispose();
    this.depthClipRT.dispose();

    // Dispose geometry and materials
    this.fullscreenGeometry.dispose();
    this.depthClipMaterial.dispose();
    this.edgeDetectMaterial.dispose();
    this.compositeMaterial.dispose();

    // Dispose debug views
    this.debugView1?.dispose();
    this.debugView2?.dispose();
  }
}
