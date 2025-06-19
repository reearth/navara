import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { Pass } from "postprocessing";
import {
  HalfFloatType,
  LinearFilter,
  NoBlending,
  RGBAFormat,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

const fragmentShader = `
#include <packing>

uniform sampler2D tNormal;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(tNormal, vUv);
}
`;

/**
 * A pass that copies normal buffer contents to a render target.
 */
export class NormalCopyPass extends Pass {
  private _renderTarget: WebGLRenderTarget;
  private _material: ShaderMaterial;
  private _autoResize: boolean;

  constructor(renderTarget?: WebGLRenderTarget, autoResize = true) {
    super("NormalCopyPass");

    this.needsSwap = false;

    this._material = new ShaderMaterial({
      uniforms: {
        tNormal: { value: null },
      },
      vertexShader: PostProcessingCommon,
      fragmentShader,
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });

    this._autoResize = autoResize;

    if (renderTarget) {
      this._renderTarget = renderTarget;
    } else {
      this._renderTarget = new WebGLRenderTarget(1, 1, {
        format: RGBAFormat,
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        generateMipmaps: false,
        stencilBuffer: false,
        depthBuffer: false,
      });
    }

    this.fullscreenMaterial = this._material;
  }

  get texture(): Texture {
    return this._renderTarget.texture;
  }

  get autoResize(): boolean {
    return this._autoResize;
  }

  set autoResize(value: boolean) {
    this._autoResize = value;
  }

  setNormalTexture(texture: Texture): void {
    this._material.uniforms.tNormal.value = texture;
  }

  setSize(width: number, height: number): void {
    if (this._autoResize) {
      this._renderTarget.setSize(width, height);
    }
  }

  render(
    renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget | null,
    _outputBuffer: WebGLRenderTarget | null,
  ): void {
    const renderTarget = this.renderToScreen ? null : this._renderTarget;

    renderer.setRenderTarget(renderTarget);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this._renderTarget.dispose();
    this._material.dispose();
  }
}
