import type { Globe } from "@navara/core";
import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Mesh,
  Object3D,
  Scene,
  RGBAFormat,
  Color,
  type Texture,
} from "three";

import type { EffectSlotRegistry } from "../core/EffectSlotRegistry";
import { getSelectiveEffectConfig } from "../core/SelectiveEffectHelper";
import { isEffectIdsMesh } from "../mesh/effectIdsMesh";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import { CustomRenderPass } from "./CustomRenderPass";

// Slots 0-2 are encoded directly as RGB channels in the shader output.
// slot 0 = R, slot 1 = G, slot 2 = B
// Multiple slots → additive (e.g. slot 0+1 = yellow, slot 0+2 = magenta)

/**
 * EffectIdsBufferPass — independent RT for per-pixel effect slot identification (PickHelper pattern).
 *
 * Records which effect slots each pixel belongs to.
 * Slots 0-2 are encoded directly as RGB channels (slot 0 = R, slot 1 = G, slot 2 = B).
 * Multiple slots → additive (e.g. slot 0+1 = yellow).
 */
export class EffectIdsBufferPass extends CustomRenderPass {
  private _renderer: WebGLRenderer;
  private effectIdsRT: WebGLRenderTarget;
  private _slotRegistry: EffectSlotRegistry;
  private readonly _tempClearColor = new Color();
  private _savedOpaqueVisible = true;
  private _savedGlobeVisible = true;
  private _pixelBuffer?: Uint8Array;
  private debugCanvases?: {
    container: HTMLDivElement;
    ctx: CanvasRenderingContext2D;
    tempCtx: CanvasRenderingContext2D;
  };

  constructor(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
    slotRegistry: EffectSlotRegistry,
  ) {
    super(scenes, camera, meshes, inputBuffer, globe, {
      disableShadow: true,
      allowTransparent: false,
    });

    this._renderer = renderer;
    this._slotRegistry = slotRegistry;

    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    this.effectIdsRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.effectIdsRT.texture.name = "EffectIdsBuffer";
  }

  get texture(): Texture {
    return this.effectIdsRT.texture;
  }

  private toggleEffectIdsMode(enabled: boolean): void {
    // Enhanced meshes via interface
    for (const [_key, obj] of this._meshes) {
      if (isEffectIdsMesh(obj)) {
        if (enabled) {
          const mask = this.computeMaskForObject(obj);
          obj._setEffectIdsMode(true, mask);
        } else {
          obj._setEffectIdsMode(false, 0);
        }
      }
    }

    // Non-enhanced meshes via material.userData
    const modeValue = enabled ? 1 : 0;
    this._scenes.mrt.traverse((obj: Object3D) => {
      if (obj instanceof Mesh && obj.material?.userData?.uEffectIdsMode) {
        obj.material.userData.uEffectIdsMode.value = modeValue;
        if (enabled) {
          const mask = this.computeMaskForObject(obj);
          obj.material.userData.uEffectIdsMask.value = mask;
        } else {
          obj.material.userData.uEffectIdsMask.value = 0;
        }
      }
    });

    if (enabled) {
      this._savedOpaqueVisible = this._scenes.opaque.visible;
      this._savedGlobeVisible = this._scenes.globe.visible;
      this._scenes.opaque.visible = false;
      this._scenes.globe.visible = false;
    } else {
      this._scenes.opaque.visible = this._savedOpaqueVisible;
      this._scenes.globe.visible = this._savedGlobeVisible;
    }
  }

  /**
   * Compute bitmask for an object.
   * For EffectIdsMesh: uses _getEffectIds() which reads from ViewContext (layer-level SoT).
   * For non-enhanced meshes: falls back to userData.selectiveEffectConfig.
   */
  private computeMaskForObject(obj: Object3D): number {
    if (isEffectIdsMesh(obj)) {
      return this._slotRegistry.computeMask(obj._getEffectIds());
    }
    const config = getSelectiveEffectConfig(obj);
    if (config) {
      return this._slotRegistry.computeMask(config.effectIds);
    }
    return 0;
  }

  public processRender(): void {
    if (this._slotRegistry.size === 0) return;

    this._renderer.getClearColor(this._tempClearColor);
    const orgClearAlpha = this._renderer.getClearAlpha();

    this._renderer.setClearColor(0x000000, 0);

    this.toggleEffectIdsMode(true);

    this.render(this._renderer, this.effectIdsRT, null);

    this.toggleEffectIdsMode(false);

    this._renderer.setClearColor(this._tempClearColor, orgClearAlpha);
  }

  protected _renderWithWorld(renderer: WebGLRenderer, scene: Scene): void {
    renderer.render(scene, this._camera);
  }

  // --- Debug view ---

  private static readonly DEBUG_PANEL_WIDTH = 400;

  public enableDebugView(enabled: boolean): void {
    if (enabled && !this.debugCanvases) {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.bottom = "0px";
      container.style.left = "0px";
      container.style.background = "rgba(0,0,0,0.7)";
      container.style.padding = "2px";
      container.style.zIndex = "1000";
      document.body.appendChild(container);

      const w = this.effectIdsRT.width;
      const h = this.effectIdsRT.height;
      const panelW = EffectIdsBufferPass.DEBUG_PANEL_WIDTH;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${panelW}px`;
      canvas.style.height = "auto";
      canvas.style.display = "block";

      const labelEl = document.createElement("div");
      labelEl.textContent = "EffectIds (R=slot0, G=slot1, B=slot2)";
      labelEl.style.color = "#fff";
      labelEl.style.fontSize = "10px";
      labelEl.style.fontFamily = "monospace";
      labelEl.style.textAlign = "center";

      container.appendChild(canvas);
      container.appendChild(labelEl);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2d context");

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Failed to get 2d context");

      this._pixelBuffer = new Uint8Array(w * h * 4);
      this.debugCanvases = { container, ctx, tempCtx };
    } else if (!enabled && this.debugCanvases) {
      this.debugCanvases.container.remove();
      this.debugCanvases = undefined;
      this._pixelBuffer = undefined;
    }
  }

  public renderDebugView(): void {
    if (!this.debugCanvases || !this._pixelBuffer) return;

    const width = this.effectIdsRT.width;
    const height = this.effectIdsRT.height;

    this._renderer.readRenderTargetPixels(
      this.effectIdsRT,
      0,
      0,
      width,
      height,
      this._pixelBuffer,
    );

    const { ctx, tempCtx } = this.debugCanvases;
    const imageData = tempCtx.createImageData(width, height);
    const data = imageData.data;

    // RGB channels directly represent slots 0-2
    for (let i = 0; i < width * height; i++) {
      const j = i * 4;
      data[j] = this._pixelBuffer[j]; // R = slot 0
      data[j + 1] = this._pixelBuffer[j + 1]; // G = slot 1
      data[j + 2] = this._pixelBuffer[j + 2]; // B = slot 2
      data[j + 3] = 255;
    }

    tempCtx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.translate(0, height);
    ctx.scale(1, -1);
    ctx.drawImage(tempCtx.canvas, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Lifecycle ---

  override setSize(width: number, height: number): void {
    super.setSize(width, height);
    this.effectIdsRT.setSize(width, height);
    if (this._pixelBuffer) {
      this._pixelBuffer = new Uint8Array(width * height * 4);
    }
  }

  public dispose(): void {
    this.effectIdsRT.dispose();
    this.debugCanvases?.container.remove();
    this.debugCanvases = undefined;
    this._pixelBuffer = undefined;
  }
}
