import SelectiveEffectMaskChunk from "@shaders/glsl/chunks/selective_effect_mask.glsl?raw";
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
} from "three";

import { Color } from "../../Color";
import type {
  EffectConfig,
  EffectUpdate,
} from "../../core/EffectDesc";
import type { BaseInstance } from "../../core/BaseDesc";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";
import type ThreeView from "../../index";

import {
  SelectiveEffectDesc,
  type SelectiveEffectConfig,
  createFullscreenQuad,
} from "./SelectiveEffectDesc";

// Selective Outline configuration
export type SelectiveOutlineConfig = {
  color?: Color;
  thickness?: number;
  edgeStrength?: number;
  resolutionScale?: number;
};

export type SelectiveOutlineEffectConfig = {
  selectiveOutline: SelectiveOutlineConfig;
} & SelectiveEffectConfig;

export type SelectiveOutlineEffectUpdate = {
  selectiveOutline?: Partial<SelectiveOutlineConfig>;
} & EffectUpdate;

const DEFAULT_COLOR = 0xffffff;
const DEFAULT_THICKNESS = 1.0;
const DEFAULT_EDGE_STRENGTH = 1.0;

/**
 * Selective Outline Effect Layer
 *
 * Uses EffectIds Buffer to apply outline to selected objects.
 * Extract mask → Sobel edge detection → Composite with base scene.
 */
export class SelectiveOutlineEffectDesc extends SelectiveEffectDesc<
  SelectiveOutlineEffectConfig,
  SelectiveOutlineEffectUpdate
> {
  static key = "selectiveOutline";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private outlinePass?: SelectiveOutlinePass;

  private get outline(): SelectiveOutlineConfig {
    return this.config.selectiveOutline;
  }

  get outlineColor(): Color {
    const color = this.outline.color;
    return color instanceof Color ? color : new Color().setHex(DEFAULT_COLOR);
  }

  get outlineThickness(): number {
    return this.outline.thickness ?? DEFAULT_THICKNESS;
  }

  get outlineEdgeStrength(): number {
    return this.outline.edgeStrength ?? DEFAULT_EDGE_STRENGTH;
  }

  constructor(view: ThreeView, ctx: ViewContext, config: EffectConfig) {
    const c =
      (config as Partial<SelectiveOutlineEffectConfig>).selectiveOutline ?? {};

    const postEffectConfig: SelectiveOutlineEffectConfig = {
      ...(config as SelectiveOutlineEffectConfig),
      selectiveEffect: true,
      selectiveOutline: {
        color: c.color ?? new Color().setHex(DEFAULT_COLOR),
        thickness: c.thickness ?? DEFAULT_THICKNESS,
        edgeStrength: c.edgeStrength ?? DEFAULT_EDGE_STRENGTH,
        resolutionScale: c.resolutionScale ?? 1.0,
      },
    };

    super(view, ctx, postEffectConfig);
  }

  createPass() {
    const rawPass = new SelectiveOutlinePass(this);
    this.outlinePass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveOutlinePass, null> & BaseInstance;
  }

  onUpdateConfig(updates: SelectiveOutlineEffectUpdate): void {
    super.onUpdateConfig(updates);

    const outlineUpdates = updates.selectiveOutline;
    if (!outlineUpdates) return;

    let changed = false;

    if (outlineUpdates.color !== undefined) {
      this.config.selectiveOutline.color = outlineUpdates.color;
      changed = true;
    }
    if (outlineUpdates.thickness !== undefined) {
      this.config.selectiveOutline.thickness = outlineUpdates.thickness;
      changed = true;
    }
    if (outlineUpdates.edgeStrength !== undefined) {
      this.config.selectiveOutline.edgeStrength = outlineUpdates.edgeStrength;
      changed = true;
    }
    if (outlineUpdates.resolutionScale !== undefined) {
      this.config.selectiveOutline.resolutionScale =
        outlineUpdates.resolutionScale;
    }

    if (changed) {
      this.outlinePass?.setParameters(
        this.outlineColor,
        this.outlineThickness,
        this.outlineEdgeStrength,
      );
    }
  }
}

/**
 * Buffer-based Selective Outline Pass.
 *
 * Pipeline: Extract mask from EffectIds Buffer → Sobel edge detection → Composite with base.
 * Reads from EffectIds Buffer in the GBuffer MRT.
 */
class SelectiveOutlinePass extends PostProcessingPass {
  private layer: SelectiveOutlineEffectDesc;

  private maskRT: WebGLRenderTarget;
  private edgeRT: WebGLRenderTarget;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private extractScene: Scene;
  private extractMaterial: ShaderMaterial;

  private edgeDetectScene: Scene;
  private edgeDetectMaterial: ShaderMaterial;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  constructor(layer: SelectiveOutlineEffectDesc) {
    super("SelectiveOutlinePass");
    this.layer = layer;

    const renderer = layer.viewContext.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale =
      layer.layerConfig.selectiveOutline.resolutionScale ?? 1.0;
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Extract material: reads EffectIds Buffer → binary mask
    this.extractMaterial = new ShaderMaterial({
      uniforms: {
        tEffectIds: { value: null },
        slotBit: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tEffectIds;
        uniform int slotBit;

        varying vec2 vUv;

        ${SelectiveEffectMaskChunk}

        void main() {
          float maskValue = texture2D(tEffectIds, vUv).r;
          float bitValue = extractEffectBit(maskValue, slotBit);

          float mask = bitValue > 0.5 ? 1.0 : 0.0;
          gl_FragColor = vec4(vec3(mask), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.extractScene = new Scene();
    this.extractScene.add(
      new Mesh(this.fullscreenGeometry, this.extractMaterial),
    );

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

        float sampleMask(vec2 uv) {
          vec3 rgb = texture2D(tMask, uv).rgb;
          return length(rgb) > 0.1 ? 1.0 : 0.0;
        }

        void main() {
          vec2 texel = 1.0 / resolution;
          vec2 offset = texel * thickness;

          float tl = sampleMask(vUv + offset * vec2(-1.0,  1.0));
          float t  = sampleMask(vUv + offset * vec2( 0.0,  1.0));
          float tr = sampleMask(vUv + offset * vec2( 1.0,  1.0));
          float l  = sampleMask(vUv + offset * vec2(-1.0,  0.0));
          float r  = sampleMask(vUv + offset * vec2( 1.0,  0.0));
          float bl = sampleMask(vUv + offset * vec2(-1.0, -1.0));
          float b  = sampleMask(vUv + offset * vec2( 0.0, -1.0));
          float br = sampleMask(vUv + offset * vec2( 1.0, -1.0));

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

    // Composite material: blend outline with base scene
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tEdge: { value: null },
        outlineColor: { value: new Color().setHex(0xffffff).raw },
        thickness: { value: 1.0 },
        resolution: { value: new Vector2(initialWidth, initialHeight) },
        bypass: { value: 0 },
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
        uniform sampler2D tEdge;
        uniform vec3 outlineColor;
        uniform float thickness;
        uniform vec2 resolution;
        uniform int bypass;

        varying vec2 vUv;

        float sampleEdge(vec2 uv, vec2 texel) {
          float edgeCenter = texture2D(tEdge, uv).r;
          float edgeHPos = texture2D(tEdge, uv + texel * vec2(thickness, 0.0)).r;
          float edgeHNeg = texture2D(tEdge, uv + texel * vec2(-thickness, 0.0)).r;
          float edgeVPos = texture2D(tEdge, uv + texel * vec2(0.0, thickness)).r;
          float edgeVNeg = texture2D(tEdge, uv + texel * vec2(0.0, -thickness)).r;
          return max(edgeCenter, max(max(edgeHPos, edgeHNeg), max(edgeVPos, edgeVNeg)));
        }

        void main() {
          vec4 baseColor = texture2D(tBase, vUv);
          if (bypass > 0) {
            gl_FragColor = baseColor;
            return;
          }
          vec2 texel = 1.0 / resolution;

          float edge = clamp(sampleEdge(vUv, texel), 0.0, 1.0);

          vec3 finalColor = mix(baseColor.rgb, outlineColor, edge);
          gl_FragColor = vec4(finalColor, baseColor.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.setParameters(
      layer.outlineColor,
      layer.outlineThickness,
      layer.outlineEdgeStrength,
    );

    this.compositeScene = new Scene();
    this.compositeScene.add(
      new Mesh(this.fullscreenGeometry, this.compositeMaterial),
    );

    // Render targets for extract + edge detection
    this.maskRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.maskRT.texture.name = `SelectiveOutline_Mask_${layer.id}`;

    this.edgeRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.edgeRT.texture.name = `SelectiveOutline_Edge_${layer.id}`;

    this.size.set(initialWidth, initialHeight);
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
    this.maskRT.setSize(width, height);
    this.edgeRT.setSize(width, height);
    this.edgeDetectMaterial.uniforms.resolution.value.set(width, height);
    this.compositeMaterial.uniforms.resolution.value.set(width, height);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    _deltaTime?: number,
  ): void {
    const resScale =
      this.layer.layerConfig.selectiveOutline.resolutionScale ?? 1.0;
    this.updateSizes(
      Math.floor(inputBuffer.width * resScale),
      Math.floor(inputBuffer.height * resScale),
    );

    // Get buffer textures
    const effectIdsBuffer = this.layer.getEffectIdsBuffer();
    const slot = this.layer.getEffectSlot();

    // Passthrough if buffers not available — bypass composite to avoid null tEdge sampling
    if (!effectIdsBuffer || slot < 0) {
      this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
      // Bind inputBuffer to avoid null sampler (bypass=1 skips edge sampling)
      this.compositeMaterial.uniforms.tEdge.value = inputBuffer.texture;
      this.compositeMaterial.uniforms.bypass.value = 1;
      renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
      renderer.render(this.compositeScene, this.fullscreenCamera);
      return;
    }

    // Step 1: Extract binary mask from EffectIds Buffer
    this.extractMaterial.uniforms.tEffectIds.value = effectIdsBuffer;
    this.extractMaterial.uniforms.slotBit.value = slot;

    renderer.setRenderTarget(this.maskRT);
    renderer.render(this.extractScene, this.fullscreenCamera);

    // Step 2: Sobel edge detection on mask
    this.edgeDetectMaterial.uniforms.tMask.value = this.maskRT.texture;
    renderer.setRenderTarget(this.edgeRT);
    renderer.render(this.edgeDetectScene, this.fullscreenCamera);

    // Step 3: Composite outline with base scene
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tEdge.value = this.edgeRT.texture;
    this.compositeMaterial.uniforms.bypass.value = 0;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);
  }

  dispose(): void {
    this.extractScene.clear();
    this.edgeDetectScene.clear();
    this.compositeScene.clear();
    this.maskRT.dispose();
    this.edgeRT.dispose();
    this.fullscreenGeometry.dispose();
    this.extractMaterial.dispose();
    this.edgeDetectMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
