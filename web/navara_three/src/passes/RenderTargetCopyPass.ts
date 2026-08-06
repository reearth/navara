import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { Pass } from "postprocessing";
import {
  AlwaysDepth,
  NoBlending,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

const fragmentShader = `
uniform sampler2D color;

#ifdef COPY_DEPTH
uniform sampler2D depth;
#endif

varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(color, vUv);
  #ifdef COPY_DEPTH
  gl_FragDepth = texture2D(depth, vUv).r;
  #endif
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

  /** Points the pass at a rebuilt render target (same-purpose replacement). */
  setRenderTarget(renderTarget: WebGLRenderTarget): void {
    this._renderTarget = renderTarget;
    this.setTexture(renderTarget.texture);
  }

  /**
   * When a depth texture is set, the pass copies its depth into the target's
   * depth buffer via gl_FragDepth. Depth test must be enabled (with AlwaysDepth)
   * because GL discards depth writes while the depth test is disabled.
   */
  setDepthTexture(texture: Texture | null): void {
    this._material.uniforms.depth.value = texture;
    const copyDepth = texture !== null;
    if ("COPY_DEPTH" in this._material.defines === copyDepth) return;
    if (copyDepth) {
      this._material.defines.COPY_DEPTH = "";
    } else {
      delete this._material.defines.COPY_DEPTH;
    }
    this._material.depthWrite = copyDepth;
    this._material.depthTest = copyDepth;
    this._material.depthFunc = AlwaysDepth;
    this._material.needsUpdate = true;
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
