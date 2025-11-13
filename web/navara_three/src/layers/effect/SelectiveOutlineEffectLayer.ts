import { Pass as PostProcessingPass } from "postprocessing";
import {
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

import type { EffectLayerConfig } from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  SelectiveEffectLayerBase,
  type SelectiveEffectConfig,
  type SelectiveOutlineConfig,
  type SelectiveOutlineUpdate,
} from "./SelectiveEffectLayer";

/**
 * Selective Outline Effect Layer
 * Renders outline edges for selected objects using Sobel edge detection
 */
export class SelectiveOutlineEffectLayer extends SelectiveEffectLayerBase<
  SelectiveEffectConfig,
  SelectiveOutlineUpdate
> {
  static key = "selectiveOutline";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  public outlineColor: Color;
  public thickness: number;
  public edgeStrength: number;

  constructor(view: ViewContext, config: EffectLayerConfig) {
    // Extract selectiveOutline config
    const selectiveOutlineConfig =
      "selectiveOutline" in config
        ? (config as SelectiveOutlineConfig).selectiveOutline
        : {};

    // Type-safe config extraction with optional properties
    type ConfigWithOptionalProps = EffectLayerConfig & {
      resolutionScale?: number;
      debugMask?: boolean;
    };

    const typedConfig = config as ConfigWithOptionalProps;

    // Ensure config has selective: true
    const selectiveConfig: SelectiveEffectConfig = {
      ...config,
      selective: true,
      resolutionScale: typedConfig.resolutionScale ?? 1.0,
      debugMask: typedConfig.debugMask ?? false,
    };

    super(view, selectiveConfig);

    // Initialize outline parameters
    this.outlineColor = new Color(selectiveOutlineConfig.color ?? 0x00ff00);
    this.thickness = selectiveOutlineConfig.thickness ?? 2.0;
    this.edgeStrength = selectiveOutlineConfig.edgeStrength ?? 1.0;
  }

  createPass() {
    // Create custom pass
    const rawPass = new OutlinePass(this);
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<OutlinePass, null> & BaseInstance;
  }

  onUpdateConfig(updates: SelectiveOutlineUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.selectiveOutline) {
      const outlineConfig = updates.selectiveOutline;

      if (outlineConfig.color !== undefined) {
        this.outlineColor.setHex(outlineConfig.color);
      }

      if (outlineConfig.thickness !== undefined) {
        this.thickness = outlineConfig.thickness;
      }

      if (outlineConfig.edgeStrength !== undefined) {
        this.edgeStrength = outlineConfig.edgeStrength;
      }
    }
  }
}

/**
 * Custom PostProcessing Pass for Outline Effect
 * Uses Sobel edge detection to render outlines
 */
class OutlinePass extends PostProcessingPass {
  private layer: SelectiveOutlineEffectLayer;
  private outlineMaterial: ShaderMaterial;
  private fsScene: Scene;
  private fsCamera: OrthographicCamera;
  private quad: Mesh;

  constructor(layer: SelectiveOutlineEffectLayer) {
    super("OutlinePass");
    this.layer = layer;

    // Get renderer for resolution
    const renderer =
      layer["view"].renderPassOrchestrator.effectComposer.getRenderer();
    const size = renderer.getSize(new Vector2());

    // Create outline shader material
    this.outlineMaterial = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tMask: { value: null },
        resolution: { value: size },
        outlineColor: { value: layer.outlineColor },
        thickness: { value: layer.thickness },
        edgeStrength: { value: layer.edgeStrength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tMask;
        uniform vec2 resolution;
        uniform vec3 outlineColor;
        uniform float thickness;
        uniform float edgeStrength;
        
        varying vec2 vUv;
        
        // Sobel edge detection
        float detectEdge(vec2 uv) {
          vec2 offset = vec2(thickness) / resolution;
          
          // Sample 3x3 grid
          float tl = texture2D(tMask, uv + vec2(-offset.x, offset.y)).r;
          float t  = texture2D(tMask, uv + vec2(0.0, offset.y)).r;
          float tr = texture2D(tMask, uv + vec2(offset.x, offset.y)).r;
          float l  = texture2D(tMask, uv + vec2(-offset.x, 0.0)).r;
          float c  = texture2D(tMask, uv).r;
          float r  = texture2D(tMask, uv + vec2(offset.x, 0.0)).r;
          float bl = texture2D(tMask, uv + vec2(-offset.x, -offset.y)).r;
          float b  = texture2D(tMask, uv + vec2(0.0, -offset.y)).r;
          float br = texture2D(tMask, uv + vec2(offset.x, -offset.y)).r;
          
          // Sobel operator
          float gx = (tr + 2.0*r + br) - (tl + 2.0*l + bl);
          float gy = (bl + 2.0*b + br) - (tl + 2.0*t + tr);
          
          return sqrt(gx*gx + gy*gy);
        }
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float edge = detectEdge(vUv);
          
          // Apply outline where edge is detected
          float threshold = edgeStrength * 0.1;
          if (edge > threshold) {
            // Mix original color with outline color based on edge strength
            float outlineWeight = clamp(edge * 2.0, 0.0, 1.0);
            gl_FragColor = vec4(mix(color.rgb, outlineColor, outlineWeight), 1.0);
          } else {
            gl_FragColor = color;
          }
        }
      `,
    });

    // Create fullscreen quad using three.js
    this.fsScene = new Scene();
    this.fsCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geometry, this.outlineMaterial);
    this.fsScene.add(this.quad);

    this.needsSwap = true;
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    // 1. Render mask
    this.layer["renderMask"](renderer);

    // 2. Update uniforms
    this.outlineMaterial.uniforms.tDiffuse.value = inputBuffer.texture;
    this.outlineMaterial.uniforms.tMask.value =
      this.layer["resources"].maskRT.texture;
    this.outlineMaterial.uniforms.outlineColor.value = this.layer.outlineColor;
    this.outlineMaterial.uniforms.thickness.value = this.layer.thickness;
    this.outlineMaterial.uniforms.edgeStrength.value = this.layer.edgeStrength;

    // 3. Update resolution
    const size = renderer.getSize(new Vector2());
    this.outlineMaterial.uniforms.resolution.value.set(size.x, size.y);

    // 4. Render outline effect
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.fsScene, this.fsCamera);

    // 5. Debug mask visualization (if enabled)
    if (this.layer["config"].debugMask) {
      this.layer["renderDebugMask"]();
    }
  }

  dispose() {
    this.quad.geometry.dispose();
    this.outlineMaterial.dispose();
  }
}
