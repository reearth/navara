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
  createFullscreenQuad,
} from "./SelectiveEffectLayer";
import {
  SelectiveEffectPass,
  type SelectiveEffectProcessor,
} from "./SelectiveEffectPass";

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
 */
export class SelectiveOutlineEffectLayer extends SelectiveEffectLayer<
  SelectiveOutlineEffectConfig,
  SelectiveOutlineEffectUpdate
> {
  static key = "selectiveOutline";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private effectPass?: SelectiveEffectPass;
  private outlineProcessor?: OutlineProcessor;

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
    const renderer =
      this.viewContext.renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale = this.getResolutionScale();
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    const processor = new OutlineProcessor(
      initialWidth,
      initialHeight,
      this.outlineColor,
      this.outlineThickness,
      this.outlineEdgeStrength,
    );
    this.outlineProcessor = processor;

    const debugViewsEnabled =
      this.getDebugViews() ||
      this.viewContext.debugOptions.selectiveEffectMask ||
      false;

    const rawPass = new SelectiveEffectPass(
      this,
      SELECTIVE_OUTLINE_EFFECT_KEY,
      processor,
      { resolutionScale, debugViewsEnabled },
    );
    this.effectPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveEffectPass, null> & BaseInstance;
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
        this.effectPass?.updateDebugViews(
          next.debugViews ||
            this.viewContext.debugOptions.selectiveEffectMask ||
            false,
        );
      }

      if (next.resolutionScale !== undefined) {
        this.config.selectiveOutline.resolutionScale = next.resolutionScale;
        this.updateResolutionScale(next.resolutionScale);
        this.effectPass?.updateResolutionScale(next.resolutionScale);
      }

      this.outlineProcessor?.setParameters(
        this.outlineColor,
        this.outlineThickness,
        this.outlineEdgeStrength,
      );
    }
  }
}

// ============================================================
// OutlineProcessor - implements SelectiveEffectProcessor
// ============================================================

class OutlineProcessor implements SelectiveEffectProcessor {
  readonly depthEnabledResultRT: WebGLRenderTarget;
  readonly silhouetteResultRT: WebGLRenderTarget;
  readonly maskChannel = 1; // A → grayscale for outline

  private readonly edgeDetectMaterial: ShaderMaterial;
  private readonly edgeDetectScene: Scene;
  private readonly compositeMaterial: ShaderMaterial;
  private readonly compositeScene: Scene;
  private readonly fullscreenCamera: OrthographicCamera;
  private readonly fullscreenGeometry: PlaneGeometry;

  constructor(
    initialWidth: number,
    initialHeight: number,
    color: Color,
    thickness: number,
    edgeStrength: number,
  ) {
    // Fullscreen rendering infrastructure
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Edge detection material (Sobel filter)
    this.edgeDetectMaterial = new ShaderMaterial({
      uniforms: {
        tMask: { value: null },
        resolution: { value: new Vector2(initialWidth, initialHeight) },
        edgeStrength: { value: edgeStrength },
        thickness: { value: thickness },
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
    this.edgeDetectScene.add(
      new Mesh(this.fullscreenGeometry, this.edgeDetectMaterial),
    );

    // Composite material to blend outline with base scene
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tDepthEnabledEdge: { value: null },
        tSilhouetteEdge: { value: null },
        outlineColor: { value: new Color().setHex(0xffffff).raw },
        thickness: { value: thickness },
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

    // Initialize color uniform
    this.compositeMaterial.uniforms.outlineColor.value.copy(color.raw);

    this.compositeScene = new Scene();
    this.compositeScene.add(
      new Mesh(this.fullscreenGeometry, this.compositeMaterial),
    );

    // Edge detection result RTs
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
      "SelectiveOutline_DepthEnabledEdge";

    this.silhouetteResultRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
      },
    );
    this.silhouetteResultRT.texture.name = "SelectiveOutline_SilhouetteEdge";
  }

  setParameters(color: Color, thickness: number, edgeStrength: number): void {
    this.compositeMaterial.uniforms.outlineColor.value.copy(color.raw);
    this.compositeMaterial.uniforms.thickness.value = thickness;
    this.edgeDetectMaterial.uniforms.edgeStrength.value = edgeStrength;
    this.edgeDetectMaterial.uniforms.thickness.value = thickness;
  }

  processEffect(
    renderer: WebGLRenderer,
    maskRT: WebGLRenderTarget,
    resultRT: WebGLRenderTarget,
    _deltaTime: number,
  ): void {
    this.edgeDetectMaterial.uniforms.tMask.value = maskRT.texture;
    renderer.setRenderTarget(resultRT);
    renderer.render(this.edgeDetectScene, this.fullscreenCamera);
  }

  renderComposite(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ): void {
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tDepthEnabledEdge.value =
      this.depthEnabledResultRT.texture;
    this.compositeMaterial.uniforms.tSilhouetteEdge.value =
      this.silhouetteResultRT.texture;

    renderer.setRenderTarget(outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);
  }

  onResize(width: number, height: number): void {
    this.depthEnabledResultRT.setSize(width, height);
    this.silhouetteResultRT.setSize(width, height);
    this.edgeDetectMaterial.uniforms.resolution.value.set(width, height);
    this.compositeMaterial.uniforms.resolution.value.set(width, height);
  }

  dispose(): void {
    this.depthEnabledResultRT.dispose();
    this.silhouetteResultRT.dispose();

    this.fullscreenGeometry.dispose();
    this.edgeDetectMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
