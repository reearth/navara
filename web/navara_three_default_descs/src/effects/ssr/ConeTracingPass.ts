import { ShaderPass, CopyPass } from "postprocessing";
import {
  LinearMipmapLinearFilter,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
  type TextureDataType,
  type DepthPackingStrategies,
} from "three";

import {
  ConeTracingMaterial,
  coneTracingMaterialParametersDefaults,
  type ConeTracingMaterialParameters,
} from "./ConeTracingMaterial";

export type ConeTracingPassOptions = {
  coneTracingFadeStart?: number;
  coneTracingFadeEnd?: number;
  coneTracingMaxDistance?: number;
  coneTracingIteration?: number;
  coneTracingIor?: number;
  rayTracingBuffer?: Texture | null;
  normalBuffer?: Texture | null;
} & ConeTracingMaterialParameters;

export const coneTracingPassOptionsDefaults = {
  coneTracingFadeStart: coneTracingMaterialParametersDefaults.fadeStart,
  coneTracingFadeEnd: coneTracingMaterialParametersDefaults.fadeEnd,
  coneTracingMaxDistance: coneTracingMaterialParametersDefaults.maxDistance,
  coneTracingIteration: coneTracingMaterialParametersDefaults.iteration,
  coneTracingIor: coneTracingMaterialParametersDefaults.ior,
  resolveKernelSize: coneTracingMaterialParametersDefaults.resolveKernelSize,
  rayTracingBuffer: null,
  normalBuffer: null,
} satisfies ConeTracingPassOptions;

export class ConeTracingPass extends ShaderPass {
  readonly coneTracingMaterial: ConeTracingMaterial;

  readonly copyPass: CopyPass;
  readonly mippedRenderTarget: WebGLRenderTarget;

  constructor(options?: ConeTracingPassOptions) {
    const { rayTracingBuffer, normalBuffer, ...others } = {
      ...coneTracingMaterialParametersDefaults,
      ...coneTracingPassOptionsDefaults,
      ...options,
    };

    const material = new ConeTracingMaterial({
      ...coneTracingMaterialParametersDefaults,
      ...others,
      rayTracingBuffer,
      normalBuffer,
    });

    super(material);

    this.coneTracingMaterial = material;

    // A mipmap min filter is required for the shader's textureLod() to reach
    // the pre-convolved levels: with LinearFilter (the default) GL only ever
    // samples mip 0, so the roughness-driven blur silently does nothing and
    // the raw per-ray noise passes straight through.
    this.mippedRenderTarget = new WebGLRenderTarget(1, 1, {
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
    });
    material.colorBuffer = this.mippedRenderTarget.texture;
    this.copyPass = new CopyPass(this.mippedRenderTarget, false);
  }

  update(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    _deltaTime?: number,
  ) {
    this.copyPass.render(renderer, inputBuffer, null);
  }

  override initialize(
    renderer: WebGLRenderer,
    alpha: boolean,
    frameBufferType: TextureDataType,
  ): void {
    super.initialize(renderer, alpha, frameBufferType);
    this.copyPass.initialize(renderer, alpha, frameBufferType);
  }

  setDepthTexture(
    depthTexture: Texture,
    _depthPacking?: DepthPackingStrategies,
  ): void {
    this.coneTracingMaterial.depthBuffer = depthTexture;
  }

  /**
   * Sizes the *colour* buffer the cone samples and the mip chain built over
   * it. Both the mip count and the mip-level maths that indexes it are
   * expressed in these pixels, so passing the resolve's own resolution keeps
   * the physical blur radius identical while quartering the per-frame copy and
   * mipmap work. The resolve's output resolution never comes through here; it
   * is set by whichever render target the pass is asked to render into.
   */
  override setSize(width: number, height: number): void {
    this.coneTracingMaterial.setSize(width, height);
    this.mippedRenderTarget.setSize(width, height);

    // Calculate number of mip levels
    const numMips = Math.floor(Math.log2(Math.max(width, height))) + 1;
    this.coneTracingMaterial.uniforms.uNumMips.value = numMips;
  }
}
