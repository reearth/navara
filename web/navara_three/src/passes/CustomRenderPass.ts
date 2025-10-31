import { Globe } from "@navara/core";
import { DepthCopyPass } from "postprocessing";
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

import { RenderPass } from "../effects";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import { NormalCopyPass, RenderTargetCopyPass } from ".";

export class CustomRenderPass extends RenderPass {
  protected _camera: PerspectiveCamera;
  protected _scenes: Scenes;
  protected _drapedFeatureMaterials: Map<string, Material>;
  protected _meshes: MeshCache;
  gbufferRenderTarget: WebGLRenderTarget;
  private copyPass: RenderTargetCopyPass;
  globeDepthCopyPass: DepthCopyPass;
  globeNormalCopyPass: NormalCopyPass;
  disableShadow: boolean;
  private globe: Globe;
  private combinedScene = new Scene();

  // Used to render only the shadow map
  private shadowScene = new Scene();
  private dummyShadowRenderTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
  });

  private debugNormalCopyPass?: NormalCopyPass;
  private allowTransparent: boolean;

  constructor(
    scenes: Scenes,
    camera: PerspectiveCamera,
    meshes: MeshCache,
    drapedFeatureMaterials: Map<string, Material>,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
    options?: {
      debugNormal?: boolean;
      disableShadow?: boolean;
      allowTransparent?: boolean;
    },
  ) {
    super();

    this.needsDepthTexture = true;

    this.clearPass.setClearFlags(true, true, true);

    this._scenes = scenes;
    this._camera = camera;
    this._meshes = meshes;
    this._drapedFeatureMaterials = drapedFeatureMaterials;
    this.globe = globe;

    this.gbufferRenderTarget = inputBuffer.clone();
    this.gbufferRenderTarget.textures.push(
      this.gbufferRenderTarget.texture.clone(),
    );

    this.copyPass = new RenderTargetCopyPass(this.gbufferRenderTarget);

    this.globeDepthCopyPass = new DepthCopyPass({
      depthPacking: RGBADepthPacking,
    });

    this.disableShadow = !!options?.disableShadow;
    this.allowTransparent = options?.allowTransparent ?? true;

    this.globeNormalCopyPass = new NormalCopyPass();
    this.globeNormalCopyPass.setNormalTexture(
      this.gbufferRenderTarget.textures[1],
    );
    if (options?.debugNormal) {
      this.debugNormalCopyPass = new NormalCopyPass();
      this.debugNormalCopyPass.unpackNormal = true;
      this.debugNormalCopyPass.setNormalTexture(
        this.gbufferRenderTarget.textures[1],
      );
    }
  }

  // Render the scene with world scene that includes user setting object like a light.
  protected _renderWithLight(renderer: WebGLRenderer, scene: Scene) {
    if (this.disableShadow) {
      renderer.render(scene, this._camera);
      return;
    }
    scene.add(this._scenes.light);
    renderer.render(scene, this._camera);
    scene.remove(this._scenes.light);
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

    // Render shadow map
    if (renderer.shadowMap.enabled && !this.disableShadow) {
      renderer.setRenderTarget(this.dummyShadowRenderTarget);
      this.shadowScene.add(this._scenes.globe);
      this.shadowScene.add(this._scenes.mrt);
      this.shadowScene.add(this._scenes.opaque);
      renderer.shadowMap.needsUpdate = true;
      this._renderWithLight(renderer, this.shadowScene);
      this.shadowScene.clear();
    }

    renderer.setRenderTarget(renderTarget);
    renderer.clear();

    this._renderWithLight(renderer, this._scenes.globe);

    // Set normal texture for copy pass
    this.globeNormalCopyPass.render(renderer, null, null);

    this.globeDepthCopyPass.render(renderer, null, null);

    // Set actual renderTarget again because it's changed in copy passes
    renderer.setRenderTarget(renderTarget);

    const shouldBlend =
      this.allowTransparent &&
      this.globe.transparent &&
      this.globe.hideUnderground;

    if (shouldBlend) {
      // Clear just color for blending.
      // Also avoid to reset depth before draping by stencil buffer.
      renderer.clearColor();
    }

    if (shouldDrapeByStencilTest) {
      this._renderDrapedMesh(renderer);
    }

    if (shouldBlend) {
      // Clear depth as well after stencil buffer draping.
      renderer.clearDepth();
    }

    // If globe can be transparent, need to render all scene in same scene to blend them.
    // Currently, blending is supported only with MRT scene.
    if (shouldBlend) {
      this.combinedScene.clear();
      this.combinedScene.add(this._scenes.globe);
      this.combinedScene.add(this._scenes.mrt);
      this._renderWithLight(renderer, this.combinedScene);
    } else {
      this._renderWithLight(renderer, this._scenes.mrt);
    }

    this.debugNormalCopyPass?.render(renderer, null, null);

    const finalTarget = this.renderToScreen ? null : inputBuffer;

    if (this.debugNormalCopyPass) {
      this.copyPass.setTexture(this.debugNormalCopyPass.texture);
    }
    this.copyPass.render(renderer, finalTarget, null);

    this._renderWithLight(renderer, this._scenes.opaque);
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
    this.debugNormalCopyPass?.setSize(width, height);
  }

  // Drape a feature on the terrain by stencil test.
  // Refs
  // - https://www.isprs.org/proceedings/XXXVII/congress/2_pdf/5_WG-II-5/06.pdf
  // - http://wscg.zcu.cz/WSCG2007/Papers_2007/journal/B17-full.pdf
  protected _renderDrapedMesh(renderer: WebGLRenderer) {
    const drapedFeaturesScene = this._scenes.draped;

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

      this._renderWithLight(renderer, drapedFeaturesScene);

      // Front face
      m.side = FrontSide;
      m.stencilZFail = DecrementWrapStencilOp;

      this._renderWithLight(renderer, drapedFeaturesScene);

      // Final
      m.stencilFunc = NotEqualStencilFunc;
      m.stencilFail = ZeroStencilOp;
      m.stencilZFail = ZeroStencilOp;
      m.stencilZPass = ZeroStencilOp;
      m.side = BackSide;
      m.colorWrite = true;
      m.depthTest = false;

      this._renderWithLight(renderer, drapedFeaturesScene);

      drapedFeaturesScene.remove(mesh);

      // Reset
      m.colorWrite = false;
      m.depthWrite = false;
      m.depthTest = false;
      m.stencilWrite = false;
    }
  }
}
