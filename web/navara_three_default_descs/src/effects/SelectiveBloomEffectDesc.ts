import type ThreeView from "@navara/three";
import {
  Pass,
  SelectiveEffectDesc,
  createFullscreenQuad,
  type EffectConfig,
  type EffectUpdate,
  type SelectiveEffectConfig,
  type ViewContext,
} from "@navara/three";
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

import { UnrealBloomPassRGBA } from "./UnrealBloomPassRGBA";

// Selective Bloom configuration
export type SelectiveBloomConfig = {
  strength?: number;
  radius?: number;
  threshold?: number;
  resolutionScale?: number;
};

export type SelectiveBloomEffectConfig = {
  selectiveBloom: SelectiveBloomConfig;
} & SelectiveEffectConfig;

export type SelectiveBloomEffectUpdate = {
  selectiveBloom?: Partial<SelectiveBloomConfig>;
} & EffectUpdate;

const DEFAULT_STRENGTH = 0.8;
const DEFAULT_RADIUS = 0.2;
const DEFAULT_THRESHOLD = 0.0;
const DEFAULT_BLOOM_RESOLUTION_SCALE = 0.5;

/**
 * Selective Bloom Effect Descriptor
 *
 * Uses EmissiveBuffer + EffectIds Buffer to apply bloom to selected objects.
 * Extract → Blur (UnrealBloomPassRGBA) → Composite with base scene.
 */
export class SelectiveBloomEffectDesc extends SelectiveEffectDesc<
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

  constructor(view: ThreeView, ctx: ViewContext, config: EffectConfig) {
    const c =
      (config as Partial<SelectiveBloomEffectConfig>).selectiveBloom ?? {};

    const postEffectConfig: SelectiveBloomEffectConfig = {
      ...(config as SelectiveBloomEffectConfig),
      selectiveEffect: true,
      selectiveBloom: {
        strength: c.strength ?? DEFAULT_STRENGTH,
        radius: c.radius ?? DEFAULT_RADIUS,
        threshold: c.threshold ?? DEFAULT_THRESHOLD,
        resolutionScale: c.resolutionScale ?? DEFAULT_BLOOM_RESOLUTION_SCALE,
      },
    };

    super(view, ctx, postEffectConfig);
  }

  createPass(): Pass<SelectiveBloomPass, null> {
    const rawPass = new SelectiveBloomPass(this);
    this.bloomPass = rawPass;
    return new Pass(rawPass, null, { enabled: true });
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
  private desc: SelectiveBloomEffectDesc;
  private bloom: UnrealBloomPassRGBA;

  private bloomSourceRT: WebGLRenderTarget;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private extractScene: Scene;
  private extractMaterial: ShaderMaterial;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  constructor(desc: SelectiveBloomEffectDesc) {
    super("SelectiveBloomPass");
    this.desc = desc;

    const renderer = desc.viewContext.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resolutionScale =
      desc.layerConfig.selectiveBloom.resolutionScale ??
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
    this.bloomSourceRT.texture.name = `SelectiveBloom_Source_${desc.id}`;

    this.bloom = new UnrealBloomPassRGBA(
      new Vector2(initialWidth, initialHeight),
      desc.bloomStrength,
      desc.bloomRadius,
      desc.bloomThreshold,
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
      this.desc.layerConfig.selectiveBloom.resolutionScale ??
      DEFAULT_BLOOM_RESOLUTION_SCALE;
    this.updateSizes(
      Math.floor(inputBuffer.width * resScale),
      Math.floor(inputBuffer.height * resScale),
    );

    this.setParameters(
      this.desc.bloomStrength,
      this.desc.bloomRadius,
      this.desc.bloomThreshold,
    );

    // Get buffer textures
    const emissiveBuffer = this.desc.getEmissiveBuffer();
    const effectIdsBuffer = this.desc.getEffectIdsBuffer();
    const slot = this.desc.getEffectSlot();

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
