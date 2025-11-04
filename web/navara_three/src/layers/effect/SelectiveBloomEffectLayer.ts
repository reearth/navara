import { Pass as PostProcessingPass } from "postprocessing";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { BufferView } from "../../bufferView";
import type { EffectLayerConfig } from "../../core/EffectLayerDeclaration";
import type { BaseInstance } from "../../core/LayerDeclaration";
import type { ViewContext } from "../../core/ViewContext";
import { Pass } from "../../effects";

import {
  SelectiveEffectLayerBase,
  type SelectiveBloomConfig,
  type SelectiveBloomUpdate,
} from "./SelectiveEffectLayer";

const DEFAULT_STRENGTH = 1.5;
const DEFAULT_RADIUS = 0.4;
const DEFAULT_THRESHOLD = 0.85;

/**
 * Selective Bloom Effect Layer
 * Applies UnrealBloomPass only to objects registered in the selective registry
 */
export class SelectiveBloomEffectLayer extends SelectiveEffectLayerBase<
  SelectiveBloomConfig,
  SelectiveBloomUpdate
> {
  static key = "selectiveBloom";
  static insertAfter = ["mrt"];
  static insertBefore = ["transparent"];

  public bloomStrength: number;
  public bloomRadius: number;
  public bloomThreshold: number;
  public debugMode: number; // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced

  private bloomPass?: SelectiveBloomPass;

  constructor(view: ViewContext, config: EffectLayerConfig) {
    const baseConfig = config as Partial<SelectiveBloomConfig>;
    const selectiveBloomConfig =
      "selectiveBloom" in config ? baseConfig.selectiveBloom : undefined;

    const selectiveConfig: SelectiveBloomConfig = {
      ...(config as SelectiveBloomConfig),
      selective: true,
      resolutionScale: baseConfig.resolutionScale ?? 1.0,
      debugMask: baseConfig.debugMask ?? false,
      selectiveBloom: {
        strength: selectiveBloomConfig?.strength ?? DEFAULT_STRENGTH,
        radius: selectiveBloomConfig?.radius ?? DEFAULT_RADIUS,
        threshold: selectiveBloomConfig?.threshold ?? DEFAULT_THRESHOLD,
      },
    };

    super(view, selectiveConfig);

    this.bloomStrength =
      this.config.selectiveBloom?.strength ?? DEFAULT_STRENGTH;
    this.bloomRadius = this.config.selectiveBloom?.radius ?? DEFAULT_RADIUS;
    this.bloomThreshold =
      this.config.selectiveBloom?.threshold ?? DEFAULT_THRESHOLD;
    this.debugMode = this.config.selectiveBloom?.debugMode ?? 0; // Default to normal mode
  }

  createPass() {
    const rawPass = new SelectiveBloomPass(this);
    this.bloomPass = rawPass;
    const pass = new Pass(rawPass, null, { enabled: true });

    return pass as Pass<SelectiveBloomPass, null> & BaseInstance;
  }

  onUpdateConfig(updates: SelectiveBloomUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.selectiveBloom) {
      const next = updates.selectiveBloom;

      if (!this.config.selectiveBloom) {
        this.config.selectiveBloom = {};
      }

      if (next.strength !== undefined) {
        this.bloomStrength = next.strength;
        this.config.selectiveBloom.strength = next.strength;
      }

      if (next.radius !== undefined) {
        this.bloomRadius = next.radius;
        this.config.selectiveBloom.radius = next.radius;
      }

      if (next.threshold !== undefined) {
        this.bloomThreshold = next.threshold;
        this.config.selectiveBloom.threshold = next.threshold;
      }

      if (next.debugMode !== undefined) {
        this.debugMode = next.debugMode;
        this.config.selectiveBloom.debugMode = next.debugMode;
      }

      this.bloomPass?.setParameters(
        this.bloomStrength,
        this.bloomRadius,
        this.bloomThreshold,
      );
    }
  }
}

/**
 * Custom PostProcessing Pass for Selective Bloom
 * Uses Three.js Layer system (similar to official examples)
 * 1. Renders only selected objects to a separate buffer using layers
 * 2. Applies UnrealBloomPass to that buffer (bloom spreads naturally)
 * 3. Composites bloom result back to the original scene
 */
class SelectiveBloomPass extends PostProcessingPass {
  private layer: SelectiveBloomEffectLayer;
  private bloom: UnrealBloomPass;
  private selectiveRenderTarget: WebGLRenderTarget;

  private fullscreenCamera: OrthographicCamera;
  private fullscreenGeometry: PlaneGeometry;

  private compositeScene: Scene;
  private compositeMaterial: ShaderMaterial;

  private size = new Vector2();

  // Debug views
  private debugView1?: BufferView;
  private debugView2?: BufferView;

  constructor(layer: SelectiveBloomEffectLayer) {
    super("SelectiveBloomPass");
    this.layer = layer;

    const renderer =
      layer["view"].renderPassOrchestrator.effectComposer.getRenderer();
    const renderSize = renderer.getSize(new Vector2());
    const resources = layer["resources"];
    const initialWidth = resources?.maskRT.width ?? renderSize.x;
    const initialHeight = resources?.maskRT.height ?? renderSize.y;

    this.fullscreenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fullscreenGeometry = new PlaneGeometry(2, 2);

    // Composite material to blend bloom with base scene
    this.compositeMaterial = new ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tBloom: { value: null },
        bloomIntensity: { value: 1.0 },
        debugMode: { value: 0 }, // 0: normal, 1: base only, 2: bloom only, 3: bloom enhanced
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tBase;
        uniform sampler2D tBloom;
        uniform float bloomIntensity;
        uniform int debugMode;

        varying vec2 vUv;

        void main() {
          vec4 baseColor = texture2D(tBase, vUv);
          vec4 bloomColor = texture2D(tBloom, vUv);
          
          if (debugMode == 1) {
            // Show base only
            gl_FragColor = baseColor;
          } else if (debugMode == 2) {
            // Show bloom only
            gl_FragColor = bloomColor;
          } else if (debugMode == 3) {
            // Show bloom enhanced (×100 for visibility)
            gl_FragColor = vec4(bloomColor.rgb * 100.0, 1.0);
          } else {
            // Normal composite
            gl_FragColor = vec4(baseColor.rgb + bloomColor.rgb * bloomIntensity, baseColor.a);
          }
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeScene = new Scene();
    const compositeQuad = new Mesh(
      this.fullscreenGeometry,
      this.compositeMaterial,
    );
    this.compositeScene.add(compositeQuad);

    // Render target for selected objects only
    this.selectiveRenderTarget = new WebGLRenderTarget(
      initialWidth,
      initialHeight,
    );
    this.selectiveRenderTarget.texture.name = `SelectiveBloom_Selective_${layer.id}`;

    this.bloom = new UnrealBloomPass(
      new Vector2(initialWidth, initialHeight),
      layer.bloomStrength,
      layer.bloomRadius,
      layer.bloomThreshold,
    );
    this.bloom.renderToScreen = false;

    this.size.set(initialWidth, initialHeight);

    this.needsSwap = true;
  }

  setParameters(strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  private updateSizes(width: number, height: number): void {
    if (this.size.x === width && this.size.y === height) {
      return;
    }

    this.size.set(width, height);
    this.selectiveRenderTarget.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
  ): void {
    // Get camera and selective scenes from resources
    const camera = this.layer["view"].camera;
    const { sceneDepthEnabled, sceneDepthDisabled } = this.layer["resources"];

    // Step 1: Update sizes
    this.updateSizes(inputBuffer.width, inputBuffer.height);

    // Step 2: Render selected objects to selectiveRenderTarget
    renderer.setRenderTarget(this.selectiveRenderTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);

    // Render depth-enabled objects
    renderer.render(sceneDepthEnabled, camera);

    // Render depth-disabled objects
    renderer.render(sceneDepthDisabled, camera);

    // Step 3: Apply UnrealBloomPass to the selective render
    this.setParameters(
      this.layer.bloomStrength,
      this.layer.bloomRadius,
      this.layer.bloomThreshold,
    );

    // UnrealBloomPass manages render targets internally and writes directly to selectiveRenderTarget
    this.bloom.render(
      renderer,
      this.selectiveRenderTarget,
      this.selectiveRenderTarget,
      deltaTime ?? 0,
      false,
    );

    // Step 4: Composite bloom back into the main buffer
    // Get the final output from UnrealBloomPass
    // UnrealBloomPass uses multiple render targets internally,
    // and the final output is stored in renderTargetsHorizontal[0]
    const bloomInternals = this.bloom as unknown as {
      renderTargetsHorizontal?: WebGLRenderTarget[];
    };
    const bloomOutput =
      bloomInternals.renderTargetsHorizontal?.[0] || this.selectiveRenderTarget;

    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tBloom.value = bloomOutput.texture;
    this.compositeMaterial.uniforms.bloomIntensity.value = 10.0;
    this.compositeMaterial.uniforms.debugMode.value = this.layer.debugMode;

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.compositeScene, this.fullscreenCamera);

    // Optional bloom debug overlay - show both selective and bloom outputs
    // This should be done AFTER composite to not interfere with output
    if (this.layer["config"].debugMask) {
      if (!this.debugView1) {
        this.debugView1 = new BufferView(
          this.selectiveRenderTarget.width,
          this.selectiveRenderTarget.height,
        );
      }

      if (!this.debugView2) {
        this.debugView2 = new BufferView(bloomOutput.width, bloomOutput.height);
      }

      // Show selective render (input to bloom)
      this.debugView1.render(renderer, this.selectiveRenderTarget);

      // Show bloom output
      this.debugView2.render(renderer, bloomOutput);
    }
  }

  dispose(): void {
    if (typeof this.bloom.dispose === "function") {
      this.bloom.dispose();
    }
    this.selectiveRenderTarget.dispose();
    this.fullscreenGeometry.dispose();
    this.compositeMaterial.dispose();
    this.debugView1?.dispose();
    this.debugView2?.dispose();
  }
}
