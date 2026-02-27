import { Pass as PostProcessingPass } from "postprocessing";
import {
  DepthTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  UnsignedShortType,
  type ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import { BufferView } from "../../bufferView";

import type { SelectiveEffectLayer } from "./SelectiveEffectLayer";
import {
  createDepthClipMaterial,
  createFullscreenQuad,
  applyDepthClip,
} from "./SelectiveEffectLayer";

/**
 * Selective Effect の固有処理を定義する interface。
 * Orchestrator（SelectiveEffectPass）が共通フローを制御し、
 * 各 Processor が固有のエフェクト処理と合成を担当する。
 */
export type SelectiveEffectProcessor = {
  /** エフェクト結果 RT（depthEnabled 用） */
  readonly depthEnabledResultRT: WebGLRenderTarget;
  /** エフェクト結果 RT（silhouette 用） */
  readonly silhouetteResultRT: WebGLRenderTarget;

  /**
   * mask RT にエフェクトを適用し、resultRT に書き込む。
   * Orchestrator が depthEnabled / silhouette の各パスで呼ぶ。
   */
  processEffect(
    renderer: WebGLRenderer,
    maskRT: WebGLRenderTarget,
    resultRT: WebGLRenderTarget,
    deltaTime: number,
  ): void;

  /**
   * エフェクト結果と base scene を合成して outputBuffer に描画する。
   */
  renderComposite(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
  ): void;

  /** リサイズ時のエフェクト固有リソース更新 */
  onResize(width: number, height: number): void;

  /** エフェクト固有リソースの破棄 */
  dispose(): void;
}

/**
 * Selective Effect の共通オーケストレーション。
 *
 * mask RT 管理・depth clip・debug views・size 管理を共通化し、
 * エフェクト固有処理は SelectiveEffectProcessor interface に委譲する。
 */
export class SelectiveEffectPass extends PostProcessingPass {
  private readonly processor: SelectiveEffectProcessor;
  private readonly layer: SelectiveEffectLayer;

  // Mask render targets (populated by CustomRenderPass during BaseMRT phase)
  private readonly depthEnabledMaskRT: WebGLRenderTarget;
  private readonly silhouetteMaskRT: WebGLRenderTarget;

  // Depth clip resources
  private readonly depthClipRT: WebGLRenderTarget;
  private readonly depthClipMaterial: ShaderMaterial;
  private readonly depthClipScene: Scene;
  private readonly fullscreenCamera: OrthographicCamera;
  private readonly fullscreenGeometry: PlaneGeometry;

  private readonly size = new Vector2();
  private resolutionScale: number;
  private debugViewsEnabled: boolean;

  // Debug views
  private debugView1?: BufferView;
  private debugView2?: BufferView;

  constructor(
    layer: SelectiveEffectLayer,
    effectKey: string,
    processor: SelectiveEffectProcessor,
    options: { resolutionScale: number; debugViewsEnabled: boolean },
  ) {
    super(`SelectiveEffectPass_${effectKey}`);
    this.layer = layer;
    this.processor = processor;
    this.resolutionScale = options.resolutionScale;
    this.debugViewsEnabled = options.debugViewsEnabled;

    const renderer =
      layer.viewContext.renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const initialWidth = Math.floor(renderSize.x * this.resolutionScale);
    const initialHeight = Math.floor(renderSize.y * this.resolutionScale);

    // Fullscreen rendering infrastructure (for depth clip)
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Depth clip material and scene
    this.depthClipMaterial = createDepthClipMaterial();
    this.depthClipScene = new Scene();
    this.depthClipScene.add(
      new Mesh(this.fullscreenGeometry, this.depthClipMaterial),
    );

    // DepthEnabled mask RT (with depth texture for depth clip)
    this.depthEnabledMaskRT = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
      {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: true,
      },
    );
    this.depthEnabledMaskRT.texture.name = `SelectiveEffectMask_${effectKey}_DepthEnabled_${layer.id}`;
    this.depthEnabledMaskRT.depthTexture = new DepthTexture(
      initialWidth,
      initialHeight,
      UnsignedShortType,
    );

    // Depth clip RT (no depth buffer needed)
    this.depthClipRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.depthClipRT.texture.name = `SelectiveEffect_DepthClip_${effectKey}_${layer.id}`;

    // Silhouette mask RT
    this.silhouetteMaskRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.silhouetteMaskRT.texture.name = `SelectiveEffectMask_${effectKey}_Silhouette_${layer.id}`;

    this.size.set(initialWidth, initialHeight);

    // Register occlusion-specific mask RTs with CustomRenderPass
    const customRenderPass = layer.getCustomRenderPass();
    if (customRenderPass?.setOcclusionMaskRenderTargets) {
      customRenderPass.setOcclusionMaskRenderTargets(effectKey, {
        normal: this.depthEnabledMaskRT,
        silhouette: this.silhouetteMaskRT,
      });
    }

    this.needsSwap = true;
  }

  /** Layer の onUpdateConfig から呼ぶ */
  updateResolutionScale(scale: number): void {
    this.resolutionScale = scale;
  }

  /** Layer の onUpdateConfig から呼ぶ */
  updateDebugViews(enabled: boolean): void {
    this.debugViewsEnabled = enabled;
  }

  private updateSizes(inputWidth: number, inputHeight: number): void {
    const w = Math.floor(inputWidth * this.resolutionScale);
    const h = Math.floor(inputHeight * this.resolutionScale);
    if (this.size.x === w && this.size.y === h) return;

    this.size.set(w, h);

    // DepthEnabled mask RT
    this.depthEnabledMaskRT.setSize(w, h);
    if (this.depthEnabledMaskRT.depthTexture) {
      this.depthEnabledMaskRT.depthTexture.dispose();
      this.depthEnabledMaskRT.depthTexture = new DepthTexture(
        w,
        h,
        UnsignedShortType,
      );
    }

    // Other shared RTs
    this.depthClipRT.setSize(w, h);
    this.silhouetteMaskRT.setSize(w, h);

    // Processor-owned RTs
    this.processor.onResize(w, h);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
  ): void {
    // Step 1: Update sizes (with resolutionScale)
    this.updateSizes(inputBuffer.width, inputBuffer.height);

    // Step 2: Depth clip (DepthEnabled mask → depthClipRT)
    applyDepthClip(
      renderer,
      this.depthClipMaterial,
      this.depthClipScene,
      this.fullscreenCamera,
      this.depthEnabledMaskRT,
      this.layer.getBaseDepthTexture(),
      this.depthClipRT,
    );

    // Step 3: Effect processing
    this.processor.processEffect(
      renderer,
      this.depthClipRT,
      this.processor.depthEnabledResultRT,
      deltaTime ?? 0,
    );
    this.processor.processEffect(
      renderer,
      this.silhouetteMaskRT,
      this.processor.silhouetteResultRT,
      deltaTime ?? 0,
    );

    // Step 4: Composite
    this.processor.renderComposite(
      renderer,
      inputBuffer,
      this.renderToScreen ? null : outputBuffer,
    );

    // Step 5: Debug views
    this.renderDebugViews(renderer);
  }

  private renderDebugViews(renderer: WebGLRenderer): void {
    if (this.debugViewsEnabled) {
      if (!this.debugView1) {
        this.debugView1 = new BufferView(
          this.depthEnabledMaskRT.width,
          this.depthEnabledMaskRT.height,
        );
      }
      if (!this.debugView2) {
        this.debugView2 = new BufferView(
          this.silhouetteMaskRT.width,
          this.silhouetteMaskRT.height,
        );
      }

      this.debugView1.render(renderer, this.depthEnabledMaskRT);
      this.debugView2.render(renderer, this.silhouetteMaskRT);
    } else {
      if (this.debugView1) {
        this.debugView1.dispose();
        this.debugView1 = undefined;
      }
      if (this.debugView2) {
        this.debugView2.dispose();
        this.debugView2 = undefined;
      }
    }
  }

  dispose(): void {
    // Mask RTs
    this.depthEnabledMaskRT.depthTexture?.dispose();
    this.depthEnabledMaskRT.dispose();
    this.silhouetteMaskRT.dispose();

    // Depth clip
    this.depthClipRT.dispose();
    this.fullscreenGeometry.dispose();
    this.depthClipMaterial.dispose();

    // Debug views
    this.debugView1?.dispose();
    this.debugView2?.dispose();

    // Processor
    this.processor.dispose();
  }
}
