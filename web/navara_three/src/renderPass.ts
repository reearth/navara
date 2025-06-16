import { RenderPass, DepthCopyPass } from "postprocessing";
import {
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  Material,
  NotEqualStencilFunc,
  RGBADepthPacking,
  Texture,
  WebGLRenderTarget,
  ZeroStencilOp,
  type DepthPackingStrategies,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";

import type { Scenes } from "./scene";
import type { MeshCache } from "./type";

export class CustomRenderPass extends RenderPass {
  protected _camera: PerspectiveCamera;
  protected _scenes: Scenes;
  protected _drapedFeatureMaterials: Map<string, Material>;
  protected _meshes: MeshCache;
  _globeDepthCopyPass: DepthCopyPass;
  constructor(
    scenes: Scenes,
    camera: PerspectiveCamera,
    meshes: MeshCache,
    drapedFeatureMaterials: Map<string, Material>,
  ) {
    super();

    this.needsDepthTexture = true;

    this.clearPass.setClearFlags(true, true, true);

    this._globeDepthCopyPass = new DepthCopyPass({
      depthPacking: RGBADepthPacking,
    });

    this._scenes = scenes;
    this._camera = camera;
    this._meshes = meshes;
    this._drapedFeatureMaterials = drapedFeatureMaterials;
  }

  // Render the scene with world scene that includes user setting object like a light.
  protected _renderWithWorld(renderer: WebGLRenderer, scene: Scene) {
    scene.add(this._scenes.world);
    renderer.render(scene, this._camera);
    scene.remove(this._scenes.world);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
  ) {
    const shouldDrapeByStencilTest = this._drapedFeatureMaterials.size !== 0;

    const renderTarget = this.renderToScreen ? null : inputBuffer;

    renderer.setRenderTarget(renderTarget);
    renderer.clear();

    if (this.clearPass.enabled) {
      this.clearPass.render(renderer, inputBuffer, outputBuffer);
    }

    this._renderWithWorld(renderer, this._scenes.globe);

    this._globeDepthCopyPass.render(renderer, inputBuffer, outputBuffer);

    // Set actual renderTarget again because it's set to inputBuffer in `_globeDepthCopyPass`.
    renderer.setRenderTarget(renderTarget);

    if (shouldDrapeByStencilTest) {
      this._renderDrapedMesh(renderer);
    }

    this._renderWithWorld(renderer, this._scenes.main);
  }

  setSize(width: number, height: number) {
    this._globeDepthCopyPass.setSize(width, height);
  }

  setDepthTexture(
    depthTexture: Texture,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this._globeDepthCopyPass.setDepthTexture(depthTexture, depthPacking);
  }

  // Drape a feature on the terrain by stencil test.
  // Refs
  // - https://www.isprs.org/proceedings/XXXVII/congress/2_pdf/5_WG-II-5/06.pdf
  // - http://wscg.zcu.cz/WSCG2007/Papers_2007/journal/B17-full.pdf
  protected _renderDrapedMesh(renderer: WebGLRenderer) {
    const drapedFeaturesScene = this._scenes.drapedFeatures;

    for (const [k, m] of this._drapedFeatureMaterials) {
      if (this._meshes.get(k)?.visible === false || !m.visible) continue;

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
    }
  }
}
