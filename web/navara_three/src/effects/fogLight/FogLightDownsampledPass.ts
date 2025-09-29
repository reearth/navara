import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { EffectPass, Pass, Resolution } from "postprocessing";
import {
  NoBlending,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
  type DepthPackingStrategies,
  LinearSRGBColorSpace,
  LinearFilter,
  type TextureDataType,
} from "three";

import { FogLightEffect } from "./FogLightEffect";

const CompositeFrag = `
uniform sampler2D inputBuffer;
uniform sampler2D fogLow;

varying vec2 vUv;

void main() {
  vec4 baseTex = texture2D(inputBuffer, vUv);
  vec3 base = baseTex.rgb;

  vec3 fog = texture2D(fogLow, vUv).rgb;

  vec3 color = base + fog;
  gl_FragColor = vec4(color, baseTex.a);
}
`;

export type FogLightDownsampledOptions = {
  /** 1: full-res, 2: half, 4: quarter */
  downsample: number;
};

// Renders FogLightEffect into a low-res target and composites back to full-res.
export class FogLightDownsampledPass extends Pass {
  private options: FogLightDownsampledOptions;
  private inner: EffectPass;
  private effect: FogLightEffect;
  private lowRT: WebGLRenderTarget;
  private compositeMat: ShaderMaterial;
  readonly resolution: Resolution;

  constructor(
    camera: Camera,
    effect: FogLightEffect,
    opts: FogLightDownsampledOptions,
  ) {
    super("FogLightDownsampledPass");

    this.effect = effect;
    this.options = opts;

    // Ensure the shader outputs fog-only; we composite later.
    this.effect.defines.set("FOG_ONLY_OUTPUT", "1");

    // Inner effect pass that renders into a low-res RT.
    this.inner = new EffectPass(camera, effect);

    this.lowRT = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.lowRT.texture.name = "FogLight.Low";
    // Ensure low-res fog is bilinearly upsampled when sampled in composite
    this.lowRT.texture.minFilter = LinearFilter;
    this.lowRT.texture.magFilter = LinearFilter;
    this.lowRT.texture.generateMipmaps = false;

    this.compositeMat = new ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null as Texture | null },
        fogLow: { value: this.lowRT.texture },
      },
      vertexShader: PostProcessingCommon,
      fragmentShader: CompositeFrag,
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });

    this.fullscreenMaterial = this.compositeMat;
    this.needsSwap = true; // We write into outputBuffer (or screen) after producing fogLow.
    this.needsDepthTexture = true; // Forward composer depth to inner effect.

    // Manage scaled resolution for the inner pass + lowRT.
    const scale = Math.max(1, opts.downsample ?? 1);
    this.resolution = new Resolution(
      this,
      Resolution.AUTO_SIZE,
      Resolution.AUTO_SIZE,
      1 / scale,
    );
    this.resolution.addEventListener("change", () => {
      // The composer will call setSize; we just mirror here when base size changes.
      this.setSize(this.resolution.baseWidth, this.resolution.baseHeight);
    });
  }

  // Forward depth texture to the inner pass/effect.
  setDepthTexture(
    depthTexture: Texture,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this.inner.setDepthTexture(depthTexture, depthPacking);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime: number,
    stencilTest?: boolean,
  ): void {
    // 1) Render fog (fog-only) into low-res target using the inner EffectPass.
    this.inner.render(
      renderer,
      inputBuffer,
      this.lowRT,
      deltaTime,
      stencilTest,
    );

    // 2) Composite low-res fog over full-res input.
    this.compositeMat.uniforms.inputBuffer.value = inputBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }

  setSize(width: number, height: number): void {
    // Update resolution scaling and allocate low-res target.
    this.resolution.setBaseSize(width, height);
    const w = this.resolution.width;
    const h = this.resolution.height;
    this.lowRT.setSize(w, h);
    this.effect.setSize(w, h);
  }

  initialize(
    renderer: WebGLRenderer,
    alpha: boolean,
    frameBufferType: TextureDataType,
  ): void {
    // Initialize inner pass for framebuffer precision/encoding.
    this.inner.initialize(renderer, alpha, frameBufferType);
    // Make lowRT precision match the composer.
    this.lowRT.texture.type = frameBufferType;
    // Keep low-res RT linear to avoid double-encoding paths.
    this.lowRT.texture.colorSpace = LinearSRGBColorSpace;
  }

  dispose(): void {
    super.dispose();
    this.lowRT.dispose();
    this.compositeMat.dispose();
    this.inner.dispose();
  }

  get downsample(): number {
    return this.options.downsample;
  }

  set downsample(value: number) {
    this.options.downsample = value;
    this.resolution.scale = 1 / value;
  }
}
