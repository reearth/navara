import {
  CubeCamera,
  HalfFloatType,
  WebGLCubeRenderTarget,
  type PerspectiveCamera,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

import { RenderPass } from "../effects";
import type { Scenes } from "../scene";

export class SkyEnvMapPass extends RenderPass {
  private _scenes: Scenes;
  private _camera: PerspectiveCamera;
  private cubeCamera: CubeCamera;
  public cubeRenderTarget: WebGLCubeRenderTarget;

  constructor(scenes: Scenes, camera: PerspectiveCamera, resolution = 64) {
    super();

    this._scenes = scenes;
    this._camera = camera;

    this.cubeRenderTarget = new WebGLCubeRenderTarget(resolution, {
      generateMipmaps: true,
      type: HalfFloatType,
    });

    this.cubeCamera = new CubeCamera(0.1, 1000, this.cubeRenderTarget);
  }

  render(
    renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget | null,
    _outputBuffer: WebGLRenderTarget | null,
  ) {
    this.cubeCamera.position.copy(this._camera.position);

    this.cubeCamera.update(renderer, this._scenes.skyEnvMap);
  }

  getEnvMapTexture() {
    return this.cubeRenderTarget.texture;
  }

  dispose() {
    this.cubeRenderTarget.dispose();
  }
}
