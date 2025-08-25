import { ShaderPass, CopyPass, GaussianBlurPass } from "postprocessing";
import {
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
  width?: number;
  height?: number;
  kernelSize?: number;
  coneTracingFadeStart?: number;
  coneTracingFadeEnd?: number;
  coneTracingMaxDistance?: number;
  coneTracingIteration?: number;
  rayTracingBuffer?: Texture | null;
  normalBuffer?: Texture | null;
} & ConeTracingMaterialParameters;

export const coneTracingPassOptionsDefaults = {
  coneTracingFadeStart: coneTracingMaterialParametersDefaults.fadeStart,
  coneTracingFadeEnd: coneTracingMaterialParametersDefaults.fadeEnd,
  coneTracingMaxDistance: coneTracingMaterialParametersDefaults.maxDistance,
  coneTracingIteration: coneTracingMaterialParametersDefaults.iteration,
  rayTracingBuffer: null,
  normalBuffer: null,
} satisfies ConeTracingPassOptions;

export class ConeTracingPass extends ShaderPass {
  readonly coneTracingMaterial: ConeTracingMaterial;

  readonly blurPass: GaussianBlurPass;
  readonly copyPass: CopyPass;
  readonly mippedRenderTarget: WebGLRenderTarget;
  readonly blurredRenderTarget: WebGLRenderTarget;

  constructor(options?: ConeTracingPassOptions) {
    const {
      width,
      height,
      kernelSize = 7,
      rayTracingBuffer,
      normalBuffer,
      ...others
    } = {
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

    this.mippedRenderTarget = new WebGLRenderTarget(1, 1, {
      generateMipmaps: true,
    });
    this.copyPass = new CopyPass(this.mippedRenderTarget);

    material.colorBuffer = this.mippedRenderTarget.texture;

    this.blurredRenderTarget = new WebGLRenderTarget(1, 1);
    this.blurPass = new GaussianBlurPass({
      resolutionScale: 1,
      resolutionX: width,
      resolutionY: height,
      kernelSize: kernelSize,
    });
  }

  update(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    _deltaTime?: number,
  ) {
    // Blur the cone tracing result
    this.blurPass.render(renderer, inputBuffer, this.blurredRenderTarget);

    this.copyPass.render(renderer, this.blurredRenderTarget, null);
  }

  override initialize(
    renderer: WebGLRenderer,
    alpha: boolean,
    frameBufferType: TextureDataType,
  ): void {
    super.initialize(renderer, alpha, frameBufferType);
    this.blurPass.initialize(renderer, alpha, frameBufferType);
    this.copyPass.initialize(renderer, alpha, frameBufferType);
  }

  setDepthTexture(
    depthTexture: Texture,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this.coneTracingMaterial.depthBuffer = depthTexture;
    this.blurPass.setDepthTexture(depthTexture, depthPacking);
    this.copyPass.setDepthTexture(depthTexture, depthPacking);
  }

  override setSize(width: number, height: number): void {
    super.setSize(width, height);
    this.coneTracingMaterial.setSize(width, height);

    this.blurredRenderTarget.setSize(width, height);
    this.blurPass.setSize(width, height);

    this.mippedRenderTarget.setSize(width, height);
    this.copyPass.setSize(width, height);

    // Calculate number of mip levels
    const numMips = Math.floor(Math.log2(Math.max(width, height))) + 1;
    this.coneTracingMaterial.uniforms.uNumMips.value = numMips;
  }

  override dispose(): void {
    super.dispose();
  }
}
