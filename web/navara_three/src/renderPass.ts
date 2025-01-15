import { Pass } from "postprocessing";
import {
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  Material,
  NotEqualStencilFunc,
  WebGLRenderTarget,
  ZeroStencilOp,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";

import type { Scenes } from "./scene";
import type { MeshCache } from "./type";

export class CustomRenderPass extends Pass {
  private _camera: Camera;
  private _scenes: Scenes;
  private _drapedFeatureMaterials: Map<string, Material>;
  private _globeGBufferRenderTarget: WebGLRenderTarget;
  private _meshes: MeshCache;
  constructor(
    scenes: Scenes,
    camera: Camera,
    meshes: MeshCache,
    globeGBufferRenderTarget: WebGLRenderTarget,
    drapedFeatureMaterials: Map<string, Material>,
  ) {
    super();
    this._scenes = scenes;
    this._camera = camera;
    this._meshes = meshes;
    this._globeGBufferRenderTarget = globeGBufferRenderTarget;
    this._drapedFeatureMaterials = drapedFeatureMaterials;
  }

  // Render the scene with world scene that includes user setting object like a light.
  private _renderWithWorld(renderer: WebGLRenderer, scene: Scene) {
    scene.add(this._scenes.world);
    renderer.render(scene, this._camera);
    scene.remove(this._scenes.world);
  }

  render(
    renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget,
  ) {
    const shouldDrapeByStencilTest = this._drapedFeatureMaterials.size !== 0;

    renderer.setRenderTarget(this._globeGBufferRenderTarget);
    renderer.clear();
    renderer.render(this._scenes.globeGBuffer, this._camera);

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);

    renderer.clear();

    this._renderWithWorld(renderer, this._scenes.globe);

    if (shouldDrapeByStencilTest) {
      this._renderDrapedMesh(renderer);
    }

    this._renderWithWorld(renderer, this._scenes.main);
  }

  // Drape a feature on the terrain by stencil test.
  // Refs
  // - https://www.isprs.org/proceedings/XXXVII/congress/2_pdf/5_WG-II-5/06.pdf
  // - http://wscg.zcu.cz/WSCG2007/Papers_2007/journal/B17-full.pdf
  private _renderDrapedMesh(renderer: WebGLRenderer) {
    const drapedFeaturesScene = this._scenes.drapedFeatures;

    this._drapedFeatureMaterials.forEach((m, k) => {
      // Back face
      m.stencilFunc = AlwaysStencilFunc;
      m.stencilFail = KeepStencilOp;
      m.stencilZPass = KeepStencilOp;
      m.stencilZFail = IncrementWrapStencilOp;
      m.side = BackSide;
      m.colorWrite = false;
      m.depthWrite = false;
      m.stencilWrite = true;
      m.depthTest = true;

      const mesh = this._meshes.get(k);
      if (!mesh) return;

      drapedFeaturesScene.add(mesh);

      this._renderWithWorld(renderer, drapedFeaturesScene);

      // Front face
      m.side = FrontSide;
      m.stencilZFail = DecrementWrapStencilOp;

      this._renderWithWorld(renderer, drapedFeaturesScene);

      // Final
      m.stencilFunc = NotEqualStencilFunc;
      m.stencilFail = ZeroStencilOp;
      m.stencilZFail = ZeroStencilOp;
      m.stencilZPass = ZeroStencilOp;
      m.side = BackSide;
      m.colorWrite = true;
      m.depthTest = false;

      this._renderWithWorld(renderer, drapedFeaturesScene);

      drapedFeaturesScene.remove(mesh);

      // Reset
      m.colorWrite = false;
      m.depthWrite = false;
      m.depthTest = false;
      m.stencilWrite = false;
    });
  }
}
