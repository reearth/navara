import SelectiveEffectMaskChunk from "@shaders/glsl/chunks/selective_effect_mask.glsl?raw";
import { Pass as PostProcessingPass } from "postprocessing";
import {
  HalfFloatType,
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

import { BufferView } from "../../bufferView";
import type { BaseInstance } from "../../core/Declaration";
import type {
  EffectConfig,
  EffectUpdate,
} from "../../core/EffectDeclaration";
import { SELECTIVE_BLOOM_EFFECT_KEY } from "../../core/SelectiveEffectHelper";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";
import { UnrealBloomPassRGBA } from "../../postprocessing";

import {
  SelectiveEffectDeclaration,
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./SelectiveEffectDeclaration";

// Selective Bloom configuration
export type SelectiveBloomConfig = {
  strength?: number;
  radius?: number;
  threshold?: number;
  resolutionScale?: number;
};

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
} & EffectConfig;

export type SelectiveBloomEffectUpdate = {
  selectiveBloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
    debugMode?: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
    resolutionScale?: number;
    debugViews?: boolean;
  };
} & EffectUpdate;

const DEFAULT_STRENGTH = 0.8;
const DEFAULT_RADIUS = 0.2;
const DEFAULT_THRESHOLD = 0.0;
const DEFAULT_BLOOM_RESOLUTION_SCALE = 0.5;

/**
 * Selective Bloom Effect Layer
 *
 * Uses EmissiveBuffer + EffectIds Buffer to apply bloom to selected objects.
 * Extract → Blur (UnrealBloomPassRGBA) → Composite with base scene.
 */
export class SelectiveBloomEffectDeclaration extends SelectiveEffectDeclaration<
  SelectiveBloomEffectConfig,
  SelectiveBloomEffectUpdate
> {
  static key = "selectiveBloom";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  private bloomPass?: SelectiveBloomPass;

  private get bloom(): SelectiveBloomConfig {
    return this.config.selectiveBloom;
  }

  get bloomStrength(): number {
    return this.bloom.strength ?? DEFAULT_STRENGTH;
  }

  get bloomRadius(): number {
    return this.bloom.radius ?? DEFAULT_RADIUS;
  }

  get bloomThreshold(): number {
    return this.bloom.threshold ?? DEFAULT_THRESHOLD;
  }

  constructor(view: ViewContext, config: EffectConfig) {
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
        resolutionScale: bloomConfig?.resolutionScale ?? DEFAULT_BLOOM_RESOLUTION_SCALE,
      },
    };

    super(view, postEffectConfig);
  }

  createPass() {
    const rawPass = new SelectiveBloomPass(this);
    this.bloomPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveBloomPass, null> & BaseInstance;
  }

  onUpdateConfig(updates: SelectiveBloomEffectUpdate): void {
    super.onUpdateConfig(updates);

    const bloomUpdates = updates.selectiveBloom;
    if (!bloomUpdates) return;

    let changed = false;

    if (bloomUpdates.strength !== undefined) {
      this.config.selectiveBloom.strength = bloomUpdates.strength;
      changed = true;
    }
    if (bloomUpdates.radius !== undefined) {
      this.config.selectiveBloom.radius = bloomUpdates.radius;
      changed = true;
    }
    if (bloomUpdates.threshold !== undefined) {
      this.config.selectiveBloom.threshold = bloomUpdates.threshold;
      changed = true;
    }
    if (bloomUpdates.resolutionScale !== undefined) {
      this.config.selectiveBloom.resolutionScale = bloomUpdates.resolutionScale;
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
 * Buffer-based Selective Bloom Pass.
 *
 * Pipeline: Extract bloom source → UnrealBloomPassRGBA blur → Composite with base.
 * Reads from EmissiveBuffer + EffectIds Buffer in the GBuffer MRT.
 */
class SelectiveBloomPass extends PostProcessingPass {
  private layer: SelectiveBloomEffectDeclaration;
  private bloom: UnrealBloomPassRGBA;

  private bloomSourceRT: WebGLRenderTarget;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private extractScene: Scene;
  private extractMaterial: ShaderMaterial;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  // Debug views
  private debugView1?: BufferView;
  private debugView2?: BufferView;

  constructor(layer: SelectiveBloomEffectDeclaration) {
    super("SelectiveBloomPass");
    this.layer = layer;

    const renderer = layer.viewContext.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale =
      layer.layerConfig.selectiveBloom.resolutionScale ??
      DEFAULT_BLOOM_RESOLUTION_SCALE;
    const initialWidth = Math.floor(renderSize.x * resolutionScale);
    const initialHeight = Math.floor(renderSize.y * resolutionScale);

    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Extract material: reads EmissiveBuffer + EffectIds Buffer → bloom source
    this.extractMaterial = new ShaderMaterial({
      uniforms: {
        tEmissive: { value: null },
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
        uniform sampler2D tEmissive;
        uniform sampler2D tEffectIds;
        uniform int slotBit;

        varying vec2 vUv;

        ${SelectiveEffectMaskChunk}

        void main() {
          float maskValue = texture2D(tEffectIds, vUv).r;
          float bitValue = extractEffectBit(maskValue, slotBit);

          if (bitValue > 0.5) {
            vec3 emissive = texture2D(tEmissive, vUv).rgb;
            gl_FragColor = vec4(emissive, 1.0);
          } else {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          }
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.extractScene = new Scene();
    this.extractScene.add(
      new Mesh(this.fullscreenGeometry, this.extractMaterial),
    );

    // Composite material: base + bloom additive blend
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tBloom: { value: null },
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
        uniform sampler2D tBloom;

        varying vec2 vUv;

        void main() {
          vec4 baseColor = texture2D(tBase, vUv);
          vec3 bloom = texture2D(tBloom, vUv).rgb;
          gl_FragColor = vec4(baseColor.rgb + bloom, baseColor.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeScene = new Scene();
    this.compositeScene.add(
      new Mesh(this.fullscreenGeometry, this.compositeMaterial),
    );

    // Bloom source RT (extracted emissive for bloom-targeted pixels)
    // HalfFloatType preserves HDR values (emissive intensity > 1.0)
    this.bloomSourceRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.bloomSourceRT.texture.name = `SelectiveBloom_Source_${layer.id}`;

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
    this.bloomSourceRT.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
  ): void {
    const resScale =
      this.layer.layerConfig.selectiveBloom.resolutionScale ??
      DEFAULT_BLOOM_RESOLUTION_SCALE;
    this.updateSizes(
      Math.floor(inputBuffer.width * resScale),
      Math.floor(inputBuffer.height * resScale),
    );

    this.setParameters(
      this.layer.bloomStrength,
      this.layer.bloomRadius,
      this.layer.bloomThreshold,
    );

    // Get buffer textures
    const emissiveBuffer = this.layer.getEmissiveBuffer();
    const effectIdsBuffer = this.layer.getEffectIdsBuffer();
    const slot = this.layer.getEffectSlot();

    // Passthrough if buffers not available — render base without bloom
    if (!emissiveBuffer || !effectIdsBuffer || slot < 0) {
      renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
      this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
      this.compositeMaterial.uniforms.tBloom.value = this.bloomSourceRT.texture;
      renderer.render(this.compositeScene, this.fullscreenCamera);
      return;
    }

    // Step 1: Extract bloom source from buffers
    this.extractMaterial.uniforms.tEmissive.value = emissiveBuffer;
    this.extractMaterial.uniforms.tEffectIds.value = effectIdsBuffer;
    this.extractMaterial.uniforms.slotBit.value = slot;

    renderer.setRenderTarget(this.bloomSourceRT);
    renderer.render(this.extractScene, this.fullscreenCamera);

    // Step 2: Apply bloom blur
    // UnrealBloomPassRGBA reads from readBuffer (2nd arg)
    this.bloom.render(
      renderer,
      this.bloomSourceRT, // writeBuffer (ignored)
      this.bloomSourceRT, // readBuffer (actual input)
      deltaTime ?? 0,
    );

    // Get bloom output from internal RT
    const bloomOutput = this.bloom.renderTargetsHorizontal[0];

    // Step 3: Composite bloom with base scene
    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tBloom.value =
      bloomOutput?.texture ?? this.bloomSourceRT.texture;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);
  }

  dispose(): void {
    this.extractScene.clear();
    this.compositeScene.clear();
    this.bloom.dispose();
    this.bloomSourceRT.dispose();
    this.fullscreenGeometry.dispose();
    this.extractMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
