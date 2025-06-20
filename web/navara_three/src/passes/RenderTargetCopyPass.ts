import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { Pass } from "postprocessing";
import {
  NoBlending,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

const fragmentShader = `
uniform sampler2D color;
uniform sampler2D depth;

varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(color, vUv);
  gl_FragDepth = texture2D(color, vUv).r;
}
`;

/**
 * A pass that copies normal buffer contents to a render target.
 */
export class RenderTargetCopyPass extends Pass {
  private _renderTarget: WebGLRenderTarget;
  private _material: ShaderMaterial;
  private _autoResize: boolean;

  constructor(renderTarget: WebGLRenderTarget, autoResize = true) {
    super("RenderTargetCopyPass");

    this.needsSwap = false;

    this._material = new ShaderMaterial({
      uniforms: {
        color: { value: null },
        depth: { value: null },
      },
      vertexShader: PostProcessingCommon,
      fragmentShader,
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });

    this._autoResize = autoResize;

    this._renderTarget = renderTarget;

    this.fullscreenMaterial = this._material;

    this.setTexture(renderTarget.texture);
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

  setTexture(texture: Texture): void {
    this._material.uniforms.color.value = texture;
  }

  setDepthTexture(texture: Texture): void {
    this._material.uniforms.depth.value = texture;
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    _outputBuffer: WebGLRenderTarget | null,
  ): void {
    renderer.setRenderTarget(inputBuffer);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this._renderTarget.dispose();
    this._material.dispose();
  }
}
