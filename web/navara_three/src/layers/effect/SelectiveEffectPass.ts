import { Pass as PostProcessingPass } from "postprocessing";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import { BufferView } from "../../bufferView";

import type { SelectiveEffectLayer } from "./SelectiveEffectLayer";
import { createFullscreenQuad } from "./SelectiveEffectLayer";

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
   * 結合マスクのどのチャンネルを使うか。
   * 0 = RGB (bloom), 1 = A → grayscale (outline)
   */
  readonly maskChannel: number;

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
};

/**
 * Channel extraction + depth clip shader.
 *
 * Extracts bloom (RGB) or outline (A→grayscale) from the combined mask RT,
 * and optionally clips by base scene depth.
 */
function createExtractClipMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      tCombinedMask: { value: null },
      tMaskDepth: { value: null },
      tBaseDepth: { value: null },
      uChannel: { value: 0 },
      uDepthClip: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <packing>

      uniform sampler2D tCombinedMask;
      uniform sampler2D tMaskDepth;
      uniform sampler2D tBaseDepth;
      uniform int uChannel;
      uniform int uDepthClip;

      varying vec2 vUv;

      void main() {
        vec4 mask = texture2D(tCombinedMask, vUv);

        // Depth clip (Normal occlusion only)
        if (uDepthClip > 0) {
          float baseDepth = unpackRGBAToDepth(texture2D(tBaseDepth, vUv));
          float maskDepth = texture2D(tMaskDepth, vUv).r;
          if (maskDepth > baseDepth + 0.0001) {
            gl_FragColor = vec4(0.0);
            return;
          }
        }

        // Channel extraction
        if (uChannel == 0) {
          gl_FragColor = mask;  // Bloom: RGBA pass-through
        } else {
          gl_FragColor = vec4(mask.a, mask.a, mask.a, mask.a);  // Outline: A → grayscale
        }
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Selective Effect の共通オーケストレーション。
 *
 * MaskController が所有する結合マスク RT からチャンネルを抽出し、
 * depth clip → processEffect → composite の共通フローを実行する。
 * エフェクト固有処理は SelectiveEffectProcessor interface に委譲する。
 */
export class SelectiveEffectPass extends PostProcessingPass {
  private readonly processor: SelectiveEffectProcessor;
  private readonly layer: SelectiveEffectLayer;

  // Channel extraction + depth clip resources
  private readonly extractClipMaterial: ShaderMaterial;
  private readonly extractClipScene: Scene;
  private readonly fullscreenCamera: OrthographicCamera;
  private readonly fullscreenGeometry: PlaneGeometry;

  // Temporary RT for extracted channel data (reused for both normal and silhouette)
  private readonly extractedRT: WebGLRenderTarget;

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

    // Fullscreen rendering infrastructure
    const fullscreenQuad = createFullscreenQuad();
    this.fullscreenCamera = fullscreenQuad.camera;
    this.fullscreenGeometry = fullscreenQuad.geometry;

    // Extract + clip material and scene
    this.extractClipMaterial = createExtractClipMaterial();
    this.extractClipScene = new Scene();
    this.extractClipScene.add(
      new Mesh(this.fullscreenGeometry, this.extractClipMaterial),
    );

    // Extracted RT (reused for normal extract+clip and silhouette extract)
    this.extractedRT = new WebGLRenderTarget(initialWidth, initialHeight, {
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.extractedRT.texture.name = `SelectiveEffect_Extracted_${effectKey}_${layer.id}`;

    this.size.set(initialWidth, initialHeight);

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

    this.extractedRT.setSize(w, h);

    // Processor-owned RTs
    this.processor.onResize(w, h);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
  ): void {
    // Step 1: Update sizes
    this.updateSizes(inputBuffer.width, inputBuffer.height);

    // Get combined mask RTs from MaskController via CustomRenderPass
    const customRenderPass = this.layer.getCustomRenderPass();
    const combinedNormalRT = customRenderPass?.getCombinedNormalMaskRT();
    const combinedSilhouetteRT =
      customRenderPass?.getCombinedSilhouetteMaskRT();

    const channel = this.processor.maskChannel;
    const baseDepthTexture = this.layer.getBaseDepthTexture();

    // Step 2: Extract channel + depth clip from Normal mask
    if (combinedNormalRT) {
      this.extractClipMaterial.uniforms.tCombinedMask.value =
        combinedNormalRT.texture;
      this.extractClipMaterial.uniforms.tMaskDepth.value =
        combinedNormalRT.depthTexture;
      this.extractClipMaterial.uniforms.tBaseDepth.value = baseDepthTexture;
      this.extractClipMaterial.uniforms.uChannel.value = channel;
      this.extractClipMaterial.uniforms.uDepthClip.value = 1;

      renderer.setRenderTarget(this.extractedRT);
      renderer.render(this.extractClipScene, this.fullscreenCamera);

      // Step 3: Process effect (Normal → depthEnabledResultRT)
      this.processor.processEffect(
        renderer,
        this.extractedRT,
        this.processor.depthEnabledResultRT,
        deltaTime ?? 0,
      );
    }

    // Step 4: Extract channel from Silhouette mask (no depth clip)
    if (combinedSilhouetteRT) {
      this.extractClipMaterial.uniforms.tCombinedMask.value =
        combinedSilhouetteRT.texture;
      this.extractClipMaterial.uniforms.uChannel.value = channel;
      this.extractClipMaterial.uniforms.uDepthClip.value = 0;

      renderer.setRenderTarget(this.extractedRT);
      renderer.render(this.extractClipScene, this.fullscreenCamera);

      // Step 5: Process effect (Silhouette → silhouetteResultRT)
      this.processor.processEffect(
        renderer,
        this.extractedRT,
        this.processor.silhouetteResultRT,
        deltaTime ?? 0,
      );
    }

    // Step 6: Composite
    this.processor.renderComposite(
      renderer,
      inputBuffer,
      this.renderToScreen ? null : outputBuffer,
    );

    // Step 7: Debug views (show combined mask RTs)
    this.renderDebugViews(renderer, combinedNormalRT, combinedSilhouetteRT);
  }

  private renderDebugViews(
    renderer: WebGLRenderer,
    combinedNormalRT?: WebGLRenderTarget,
    combinedSilhouetteRT?: WebGLRenderTarget,
  ): void {
    if (this.debugViewsEnabled) {
      if (combinedNormalRT) {
        if (!this.debugView1) {
          this.debugView1 = new BufferView(
            combinedNormalRT.width,
            combinedNormalRT.height,
          );
        }
        this.debugView1.render(renderer, combinedNormalRT);
      }
      if (combinedSilhouetteRT) {
        if (!this.debugView2) {
          this.debugView2 = new BufferView(
            combinedSilhouetteRT.width,
            combinedSilhouetteRT.height,
          );
        }
        this.debugView2.render(renderer, combinedSilhouetteRT);
      }
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
    // Extracted RT
    this.extractedRT.dispose();

    // Extract clip
    this.fullscreenGeometry.dispose();
    this.extractClipMaterial.dispose();

    // Debug views
    this.debugView1?.dispose();
    this.debugView2?.dispose();

    // Processor
    this.processor.dispose();
  }
}
