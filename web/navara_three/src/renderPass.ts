import { RenderPass, DepthCopyPass } from "postprocessing";
import {
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  DepthTexture,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  Material,
  NotEqualStencilFunc,
  RGBADepthPacking,
  Scene,
  WebGLRenderTarget,
  ZeroStencilOp,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";

import { ENABLE_NORMAL_BUFFER_OUTPUT } from "./constants/renderModes";
import { NormalCopyPass, RenderTargetCopyPass } from "./passes";
import type { Scenes } from "./scene";
import type { MeshCache } from "./type";

export class CustomRenderPass extends RenderPass {
  protected _camera: PerspectiveCamera;
  protected _scenes: Scenes;
  protected _drapedFeatureMaterials: Map<string, Material>;
  protected _meshes: MeshCache;
  gbufferRenderTarget: WebGLRenderTarget;
  private copyPass: RenderTargetCopyPass;
  globeDepthCopyPass: DepthCopyPass;
  globeNormalCopyPass: NormalCopyPass;
  constructor(
    scenes: Scenes,
    camera: PerspectiveCamera,
    meshes: MeshCache,
    drapedFeatureMaterials: Map<string, Material>,
    inputBuffer: WebGLRenderTarget,
  ) {
    super();

    this.needsDepthTexture = true;

    this.clearPass.setClearFlags(true, true, true);

    this._scenes = scenes;
    this._camera = camera;
    this._meshes = meshes;
    this._drapedFeatureMaterials = drapedFeatureMaterials;

    this.gbufferRenderTarget = inputBuffer.clone();
    this.gbufferRenderTarget.textures.push(
      this.gbufferRenderTarget.texture.clone(),
    );

    this.copyPass = new RenderTargetCopyPass(this.gbufferRenderTarget);

    this.globeDepthCopyPass = new DepthCopyPass({
      depthPacking: RGBADepthPacking,
    });

    this.globeNormalCopyPass = new NormalCopyPass();
    this.globeNormalCopyPass.setNormalTexture(
      this.gbufferRenderTarget.textures[1],
    );
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
    _outputBuffer: WebGLRenderTarget | null,
  ) {
    const shouldDrapeByStencilTest = this._drapedFeatureMaterials.size !== 0;

    const renderTarget = this.gbufferRenderTarget;

    if (this.clearPass.enabled) {
      this.clearPass.render(renderer, inputBuffer, null);
    }

    renderer.setRenderTarget(renderTarget);
    renderer.clear();

    this._renderWithWorld(renderer, this._scenes.globe);

    if (ENABLE_NORMAL_BUFFER_OUTPUT) {
      // Set normal texture for copy pass
      this.globeNormalCopyPass.render(renderer, null, null);
    }

    this.globeDepthCopyPass.render(renderer, null, null);

    // Set actual renderTarget again because it's changed in copy passes
    renderer.setRenderTarget(renderTarget);

    if (shouldDrapeByStencilTest) {
      this._renderDrapedMesh(renderer);
    }

    this._renderWithWorld(renderer, this._scenes.main);

    const finalTarget = this.renderToScreen ? null : inputBuffer;

    this.copyPass.render(renderer, finalTarget, null);

    this._renderWithWorld(renderer, this._scenes.post);
  }

  setDepthTexture(depthTexture: DepthTexture): void {
    this.gbufferRenderTarget.depthTexture = depthTexture;
    this.globeDepthCopyPass.setDepthTexture(depthTexture);
    this.copyPass.setDepthTexture(depthTexture);
  }

  setSize(width: number, height: number) {
    this.gbufferRenderTarget.setSize(width, height);
    this.globeDepthCopyPass.setSize(width, height);
    this.globeNormalCopyPass.setSize(width, height);
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
