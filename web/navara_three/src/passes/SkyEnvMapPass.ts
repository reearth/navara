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
    // Nothing requests the env map (no sky mesh with `envMap` enabled), so skip
    // the expensive 6-face cube render entirely.
    if (this._scenes.skyEnvMap.children.length === 0) return;

    this.cubeCamera.position.copy(this._camera.position);

    this.cubeCamera.update(renderer, this._scenes.skyEnvMap);
  }

  getEnvMapTexture(): WebGLCubeRenderTarget["texture"] | undefined {
    // Don't hand a stale/cleared cube texture to meshes when nothing populates
    // the env map scene; callers fall back to `null`.
    if (this._scenes.skyEnvMap.children.length === 0) return undefined;

    return this.cubeRenderTarget.texture;
  }

  dispose() {
    this.cubeRenderTarget.dispose();
  }
}
