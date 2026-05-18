import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { Pass } from "postprocessing";
import {
  NearestFilter,
  NoBlending,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

const fragmentShader = `
#include <packing>

uniform sampler2D tMrtDepth;
uniform sampler2D tAllDepth;

varying vec2 vUv;

#define SELECTIVE_EFFECT_OCCLUSION_EPSILON 0.00001

void main() {
  float mrtDepth = unpackRGBAToDepth(texture2D(tMrtDepth, vUv));
  float allDepth = unpackRGBAToDepth(texture2D(tAllDepth, vUv));
  float occluded = (allDepth < mrtDepth - SELECTIVE_EFFECT_OCCLUSION_EPSILON) ? 1.0 : 0.0;
  gl_FragColor = vec4(occluded, 0.0, 0.0, 1.0);
}
`;

/**
 * 1ch opaque-occlusion mask for Selective Effects.
 *
 * Compares MRT-time depth vs. final depth and writes `R = 1.0` where opaque
 * rendered closer than the MRT pixel. Runs at full resolution.
 */
export class SelectiveEffectOcclusionMaskPass extends Pass {
  private _renderTarget: WebGLRenderTarget;
  private _material: ShaderMaterial;

  constructor() {
    super("SelectiveEffectOcclusionMaskPass");

    this.needsSwap = false;

    this._renderTarget = new WebGLRenderTarget(1, 1, {
      format: RedFormat,
      type: UnsignedByteType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this._material = new ShaderMaterial({
      uniforms: {
        tMrtDepth: { value: null },
        tAllDepth: { value: null },
      },
      vertexShader: PostProcessingCommon,
      fragmentShader,
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });

    this.fullscreenMaterial = this._material;
  }

  /** Output 1ch mask texture (R=1 where occluded). */
  get texture(): Texture {
    return this._renderTarget.texture;
  }

  /** Set the MRT-time and final depth textures to compare. */
  setDepthTextures(mrtDepth: Texture | null, allDepth: Texture | null): void {
    this._material.uniforms.tMrtDepth.value = mrtDepth;
    this._material.uniforms.tAllDepth.value = allDepth;
  }

  setSize(width: number, height: number): void {
    this._renderTarget.setSize(width, height);
  }

  render(
    renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget | null,
    _outputBuffer: WebGLRenderTarget | null,
  ): void {
    renderer.setRenderTarget(this._renderTarget);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this._renderTarget.dispose();
    this._material.dispose();
  }
}
