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

import { isEmissiveOnlyMesh } from "../mesh/emissiveOnlyMesh";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import { CustomRenderPass } from "./CustomRenderPass";

/**
 * EmissiveBufferPass — independent RT for emissive data (PickHelper pattern).
 *
 * Renders the MRT scene with emissive-only output to an independent render target.
 * Each mesh's `_setEmissiveOnly(true)` sets `uEmissiveOnly` uniform,
 * causing the shader to output `vec4(uEmissiveColor, uEmissiveIntensity)`.
 *
 * Output format:
 *   RGB = emissive color
 *   A   = emissive intensity
 */
export class EmissiveBufferPass extends CustomRenderPass {
  private _renderer: WebGLRenderer;
  private emissiveRT: WebGLRenderTarget;
  private readonly _tempClearColor = new Color();
  private _pixelBuffer?: Uint8Array;
  private debugCanvases?: {
    container: HTMLDivElement;
    contexts: CanvasRenderingContext2D[];
    tempCtx: CanvasRenderingContext2D;
  };

  constructor(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
  ) {
    super(scenes, camera, meshes, inputBuffer, globe, {
      disableShadow: true,
      allowTransparent: false,
    });

    this._renderer = renderer;

    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    this.emissiveRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.emissiveRT.texture.name = "EmissiveBuffer";
  }

  get texture(): Texture {
    return this.emissiveRT.texture;
  }

  private _savedOpaqueVisible = true;
  private _savedGlobeVisible = true;

  private toggleEmissiveOnly(emissiveOnly: boolean): void {
    for (const [_key, obj] of this._meshes) {
      if (isEmissiveOnlyMesh(obj)) {
        obj._setEmissiveOnly(emissiveOnly);
      }
    }

    // Non-enhancer meshes (Box/Sphere) use material.userData.uEmissiveOnly
    const value = emissiveOnly ? 1 : 0;
    this._scenes.mrt.traverse((obj: Object3D) => {
      if (obj instanceof Mesh && obj.material?.userData?.uEmissiveOnly) {
        obj.material.userData.uEmissiveOnly.value = value;
      }
    });

    if (emissiveOnly) {
      // Save original visible state before hiding
      this._savedOpaqueVisible = this._scenes.opaque.visible;
      this._savedGlobeVisible = this._scenes.globe.visible;
      this._scenes.opaque.visible = false;
      this._scenes.globe.visible = false;
    } else {
      // Restore original visible state
      this._scenes.opaque.visible = this._savedOpaqueVisible;
      this._scenes.globe.visible = this._savedGlobeVisible;
    }
  }

  public processRender(): void {
    this._renderer.getClearColor(this._tempClearColor);
    const orgClearAlpha = this._renderer.getClearAlpha();

    this._renderer.setClearColor(0x000000, 0);

    this.toggleEmissiveOnly(true);

    this.render(this._renderer, this.emissiveRT, null);

    this.toggleEmissiveOnly(false);

    this._renderer.setClearColor(this._tempClearColor, orgClearAlpha);
  }

  protected _renderWithWorld(renderer: WebGLRenderer, scene: Scene): void {
    renderer.render(scene, this._camera);
  }

  // --- Debug view (RGB color + A intensity) ---

  private static readonly DEBUG_PANEL_WIDTH = 150;

  public enableDebugView(enabled: boolean): void {
    if (enabled && !this.debugCanvases) {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.top = "0px";
      container.style.left = "0px";
      container.style.display = "flex";
      container.style.gap = "2px";
      container.style.background = "rgba(0,0,0,0.7)";
      container.style.padding = "2px";
      container.style.zIndex = "1000";
      document.body.appendChild(container);

      const w = this.emissiveRT.width;
      const h = this.emissiveRT.height;
      const panelW = EmissiveBufferPass.DEBUG_PANEL_WIDTH;

      const labels = ["RGB", "A (intensity)"];
      const contexts = labels.map((label) => {
        const wrapper = document.createElement("div");
        wrapper.style.textAlign = "center";

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${panelW}px`;
        canvas.style.height = "auto";
        canvas.style.display = "block";

        const labelEl = document.createElement("div");
        labelEl.textContent = label;
        labelEl.style.color = "#fff";
        labelEl.style.fontSize = "10px";
        labelEl.style.fontFamily = "monospace";

        wrapper.appendChild(canvas);
        wrapper.appendChild(labelEl);
        container.appendChild(wrapper);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2d context");
        return ctx;
      });

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Failed to get 2d context");

      this._pixelBuffer = new Uint8Array(w * h * 4);
      this.debugCanvases = { container, contexts, tempCtx };
    } else if (!enabled && this.debugCanvases) {
      this.debugCanvases.container.remove();
      this.debugCanvases = undefined;
      this._pixelBuffer = undefined;
    }
  }

  public renderDebugView(): void {
    if (!this.debugCanvases || !this._pixelBuffer) return;

    const width = this.emissiveRT.width;
    const height = this.emissiveRT.height;
    this._renderer.readRenderTargetPixels(
      this.emissiveRT,
      0,
      0,
      width,
      height,
      this._pixelBuffer,
    );

    const { contexts, tempCtx } = this.debugCanvases;

    // Panel 0: RGB (alpha forced to 255)
    {
      const imageData = tempCtx.createImageData(width, height);
      const data = imageData.data;
      for (let i = 0; i < width * height; i++) {
        const j = i * 4;
        data[j] = this._pixelBuffer[j];
        data[j + 1] = this._pixelBuffer[j + 1];
        data[j + 2] = this._pixelBuffer[j + 2];
        data[j + 3] = 255;
      }
      tempCtx.putImageData(imageData, 0, 0);

      const ctx = contexts[0];
      ctx.clearRect(0, 0, width, height);
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.drawImage(tempCtx.canvas, 0, 0, width, height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Panel 1: A as grayscale (intensity)
    {
      const imageData = tempCtx.createImageData(width, height);
      const data = imageData.data;
      for (let i = 0; i < width * height; i++) {
        const v = this._pixelBuffer[i * 4 + 3];
        const j = i * 4;
        data[j] = v;
        data[j + 1] = v;
        data[j + 2] = v;
        data[j + 3] = 255;
      }
      tempCtx.putImageData(imageData, 0, 0);

      const ctx = contexts[1];
      ctx.clearRect(0, 0, width, height);
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.drawImage(tempCtx.canvas, 0, 0, width, height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  // --- Lifecycle ---

  override setSize(width: number, height: number): void {
    super.setSize(width, height);
    this.emissiveRT.setSize(width, height);
    if (this._pixelBuffer) {
      this._pixelBuffer = new Uint8Array(width * height * 4);
    }
  }

  public dispose(): void {
    this.emissiveRT.dispose();
    this.debugCanvases?.container.remove();
    this.debugCanvases = undefined;
    this._pixelBuffer = undefined;
  }
}
