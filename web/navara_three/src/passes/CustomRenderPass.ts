import { Globe } from "@navara/core";
import { DepthCopyPass } from "postprocessing";
import {
  DepthTexture,
  HalfFloatType,
  NearestFilter,
  RGBADepthPacking,
  Scene,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";

import type { SelectiveEffectRegistry } from "../core/SelectiveEffectRegistry";
import { RenderPass } from "../effects";
import { DrapedMesh } from "../mesh/DrapedMesh";
import type { Scenes } from "../scene";

import {
  AllDepthCopyPass,
  NormalCopyPass,
  RenderTargetCopyPass,
  SelectiveEffectOcclusionMaskPass,
} from ".";

/**
 * Options for CustomRenderPass
 */
export type CustomRenderPassOptions = {
  debugNormal?: boolean;
  disableShadow?: boolean;
  allowTransparent?: boolean;
  /**
   * When provided, the MRT-depth snapshot and occlusion mask pass run only
   * while at least one Selective Effect slot is registered. Skipped entirely
   * otherwise to avoid GPU work for views without selective effects.
   */
  selectiveEffectRegistry?: SelectiveEffectRegistry;
};

/**
 * G-buffer + multi-scene render pass.
 *
 * Draws `globe` / `draped` / `mrt` into `gbufferRenderTarget` (MRT: color,
 * normal, effectIds bitmask, emissive) and `opaque` into `finalTarget`
 * (MRT-less). Two depth snapshots (`mrtDepthCopyPass`, `allDepthCopyPass`)
 * feed `occlusionMaskPass`, which produces a 1ch opaque-occlusion mask
 * consumed by Selective Effect extracts.
 */
export class CustomRenderPass extends RenderPass {
  protected _camera: PerspectiveCamera;
  protected _scenes: Scenes;
  gbufferRenderTarget: WebGLRenderTarget;
  private copyPass: RenderTargetCopyPass;
  globeDepthCopyPass: DepthCopyPass;
  globeNormalCopyPass: NormalCopyPass;
  allDepthCopyPass: AllDepthCopyPass;
  /** Depth snapshot right after MRT (before opaque). */
  mrtDepthCopyPass: AllDepthCopyPass;
  /** 1ch opaque-occlusion mask for Selective Effects. */
  occlusionMaskPass: SelectiveEffectOcclusionMaskPass;
  disableShadow: boolean;
  private globe: Globe;
  private combinedScene = new Scene();
  private drapedTempScene = new Scene();

  // Used to render only the shadow map
  private shadowScene = new Scene();
  private dummyShadowRenderTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
  });

  private debugNormalCopyPass?: NormalCopyPass;
  private allowTransparent: boolean;
  private selectiveEffectRegistry?: SelectiveEffectRegistry;

  constructor(
    scenes: Scenes,
    camera: PerspectiveCamera,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
    options?: CustomRenderPassOptions,
  ) {
    super();

    this.needsDepthTexture = true;

    this.clearPass.setClearFlags(true, true, true);

    this._scenes = scenes;
    this._camera = camera;
    this.globe = globe;

    this.gbufferRenderTarget = inputBuffer.clone();
    // attachment 1: normal buffer
    this.gbufferRenderTarget.textures.push(
      this.gbufferRenderTarget.texture.clone(),
    );
    // attachment 2: effectIds buffer
    // HalfFloatType preserves integer masks up to 11 bits (0..2047) exactly.
    // NearestFilter is required because this stores discrete bitmask data.
    const effectIdsTexture = this.gbufferRenderTarget.texture.clone();
    effectIdsTexture.type = HalfFloatType;
    effectIdsTexture.minFilter = NearestFilter;
    effectIdsTexture.magFilter = NearestFilter;
    effectIdsTexture.generateMipmaps = false;
    this.gbufferRenderTarget.textures.push(effectIdsTexture);
    // attachment 3: emissive buffer (RGB=diffuseColor×intensity+emissive additive, A=unused)
    // HalfFloatType preserves HDR emissive values for bloom extraction.
    const emissiveTexture = this.gbufferRenderTarget.texture.clone();
    emissiveTexture.type = HalfFloatType;
    this.gbufferRenderTarget.textures.push(emissiveTexture);

    this.copyPass = new RenderTargetCopyPass(this.gbufferRenderTarget);

    this.globeDepthCopyPass = new DepthCopyPass({
      depthPacking: RGBADepthPacking,
    });

    this.allDepthCopyPass = new AllDepthCopyPass();
    this.mrtDepthCopyPass = new AllDepthCopyPass();
    this.occlusionMaskPass = new SelectiveEffectOcclusionMaskPass();

    this.disableShadow = !!options?.disableShadow;
    this.allowTransparent = options?.allowTransparent ?? true;
    this.selectiveEffectRegistry = options?.selectiveEffectRegistry;

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

  /** Render `scene` with the configured light temporarily attached. */
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
    const shouldDrapeByStencilTest = this._scenes.draped.children.length !== 0;

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

    const clearDepth =
      !this.globe.hideUnderground ||
      // If transparent isn't allowed, show the underground. For example, the picking process doesn't need transparency.
      // The underground should be shown when `transparent` is true to pick the underground object.
      (!this.allowTransparent && this.globe.transparent);

    renderer.setRenderTarget(renderTarget);
    renderer.clear();

    this._renderWithLight(renderer, this._scenes.globe);

    // Set normal texture for copy pass
    this.globeNormalCopyPass.render(renderer, null, null);

    this.globeDepthCopyPass.setDepthTexture(
      renderTarget.depthTexture as DepthTexture,
    );
    this.globeDepthCopyPass.render(renderer, null, null);

    if (clearDepth) {
      // Copy globe depth to the all depth buffer (later merged with min(globe, mrt+opaque))
      this.allDepthCopyPass.setDepthTexture(
        this.globeDepthCopyPass.texture,
        RGBADepthPacking,
      );
      this.allDepthCopyPass.copyDepth(false);
      this.allDepthCopyPass.render(renderer, null, null);
    }

    // Set actual renderTarget again because it's changed in copy passes
    renderer.setRenderTarget(renderTarget);

    if (clearDepth) {
      // Clear depth if hideUnderground is false.
      renderer.clearDepth();
    }

    const shouldBlend =
      !clearDepth &&
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

    // Skip the depth snapshot and mask pass when no Selective Effect is registered.
    const hasSelectiveEffect =
      (this.selectiveEffectRegistry?.slotCount ?? 0) > 0;

    // Snapshot post-MRT depth for the occlusion mask pass. Under clearDepth
    // this snapshot omits globe (allDepth re-merges it); harmless because
    // the extract bit check drops globe pixels before the mask is read.
    if (hasSelectiveEffect) {
      this.mrtDepthCopyPass.setDepthTexture(renderTarget.depthTexture);
      this.mrtDepthCopyPass.copyDepth(false);
      this.mrtDepthCopyPass.render(renderer, null, null);
    }

    this.debugNormalCopyPass?.render(renderer, null, null);

    const finalTarget = this.renderToScreen ? null : inputBuffer;

    if (this.debugNormalCopyPass) {
      this.copyPass.setTexture(this.debugNormalCopyPass.texture);
    }
    this.copyPass.render(renderer, finalTarget, null);

    // MRT-less path: opaque renders into finalTarget, not the gbuffer.
    this._renderWithLight(renderer, this._scenes.opaque);

    this.allDepthCopyPass.setDepthTexture(finalTarget?.depthTexture ?? null);
    this.allDepthCopyPass.copyDepth(clearDepth);
    this.allDepthCopyPass.render(renderer, null, null);

    if (hasSelectiveEffect) {
      this.occlusionMaskPass.setDepthTextures(
        this.mrtDepthCopyPass.texture,
        this.allDepthCopyPass.texture,
      );
      this.occlusionMaskPass.render(renderer, null, null);
    }
  }

  setDepthTexture(depthTexture: DepthTexture): void {
    this.gbufferRenderTarget.depthTexture = depthTexture;
    this.globeDepthCopyPass.setDepthTexture(depthTexture.clone());
    this.copyPass.setDepthTexture(depthTexture);
  }

  setSize(width: number, height: number) {
    this.gbufferRenderTarget.setSize(width, height);
    this.globeDepthCopyPass.setSize(width, height);
    this.allDepthCopyPass.setSize(width, height);
    this.mrtDepthCopyPass.setSize(width, height);
    this.occlusionMaskPass.setSize(width, height);
    this.globeNormalCopyPass.setSize(width, height);
    this.debugNormalCopyPass?.setSize(width, height);
  }

  // `dispose()` is inherited: `postprocessing.Pass.dispose()` walks instance
  // properties and releases all owned RTs / materials / sub-passes.

  /**
   * Drape features onto the terrain via stencil test.
   *
   * @see https://www.isprs.org/proceedings/XXXVII/congress/2_pdf/5_WG-II-5/06.pdf
   * @see http://wscg.zcu.cz/WSCG2007/Papers_2007/journal/B17-full.pdf
   */
  protected _renderDrapedMesh(renderer: WebGLRenderer) {
    const drapedScene = this._scenes.draped;
    const children = [...drapedScene.children];

    for (const child of children) {
      if (!(child instanceof DrapedMesh) || !child.enabled()) continue;

      drapedScene.remove(child);
      this.drapedTempScene.add(child);

      child.process(() =>
        this._renderWithLight(renderer, this.drapedTempScene),
      );

      this.drapedTempScene.remove(child);
      drapedScene.add(child);
    }
  }
}
