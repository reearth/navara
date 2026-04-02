import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Mesh,
  Object3D,
  RGBAFormat,
  HalfFloatType,
  Color,
  type Texture,
} from "three";

import type { EffectSlotRegistry } from "../core/EffectSlotRegistry";
import { getSelectiveEffectConfig } from "../core/SelectiveEffectHelper";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";
// --- Selective Effect Buffer Mesh interface ---

/** Interface for meshes that support Selective Effect buffer rendering. */
export type SelectiveEffectBufferMesh = {
  _setSelectiveEffectBufferMode(enabled: boolean, effectIdsMask: number): void;
  _getEffectIds(): readonly string[];
};

const isSelectiveEffectBufferMesh = (
  v: object,
): v is SelectiveEffectBufferMesh => {
  return (
    "_setSelectiveEffectBufferMode" in v &&
    typeof (v as SelectiveEffectBufferMesh)._setSelectiveEffectBufferMode ===
      "function" &&
    "_getEffectIds" in v &&
    typeof (v as SelectiveEffectBufferMesh)._getEffectIds === "function"
  );
};

/**
 * SelectiveEffectBufferPass — Dedicated Selective Effect MRT for emissive + effectIds.
 *
 * Renders the MRT scene once with `uSelectiveEffectBufferMode=1`, writing:
 *   location 0 → Emissive (HalfFloat RGBA: RGB=color, A=intensity)
 *   location 1 → EffectIds (HalfFloat RGBA: R=bitmask, GBA=reserved)
 */
export class SelectiveEffectBufferPass {
  private _renderer: WebGLRenderer;
  private _camera: PerspectiveCamera;
  private _scenes: Scenes;
  private _meshes: MeshCache;
  private _slotRegistry: EffectSlotRegistry;

  private selectiveEffectMRT: WebGLRenderTarget;
  private readonly _tempClearColor = new Color();

  private _savedOpaqueVisible = true;
  private _savedGlobeVisible = true;

  // Cache of non-enhanced meshes found during traverse (reused for OFF toggle)
  private _nonEnhancedMeshes: Mesh[] = [];

  // Debug views
  private _emissivePixelBuffer?: Float32Array;
  private _effectIdsPixelBuffer?: Float32Array;
  private emissiveDebugCanvases?: {
    container: HTMLDivElement;
    contexts: CanvasRenderingContext2D[];
    tempCtx: CanvasRenderingContext2D;
  };
  private effectIdsDebugCanvases?: {
    container: HTMLDivElement;
    ctx: CanvasRenderingContext2D;
    tempCtx: CanvasRenderingContext2D;
  };

  constructor(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    slotRegistry: EffectSlotRegistry,
  ) {
    this._renderer = renderer;
    this._camera = camera;
    this._scenes = scenes;
    this._meshes = meshes;
    this._slotRegistry = slotRegistry;

    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    // Dedicated Selective Effect MRT: 2 attachments (HalfFloat RGBA)
    this.selectiveEffectMRT = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      type: HalfFloatType,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.selectiveEffectMRT.textures.push(
      this.selectiveEffectMRT.texture.clone(),
    );
    this.selectiveEffectMRT.textures[0].name = "SelectiveEffect_Emissive";
    this.selectiveEffectMRT.textures[1].name = "SelectiveEffect_EffectIds";
  }

  get emissiveTexture(): Texture {
    return this.selectiveEffectMRT.textures[0];
  }

  get effectIdsTexture(): Texture {
    return this.selectiveEffectMRT.textures[1];
  }

  // --- Render ---

  private enableSEBufferMode(): void {
    // Enhanced meshes via interface
    for (const [_key, obj] of this._meshes) {
      if (isSelectiveEffectBufferMesh(obj)) {
        const mask = this.computeMaskForObject(obj);
        obj._setSelectiveEffectBufferMode(true, mask);
      }
    }

    // Non-enhanced meshes (Box/Sphere/Cylinder etc.) via material.userData
    // Traverse scene once and cache hits for disableSEBufferMode()
    this._nonEnhancedMeshes.length = 0;
    this._scenes.mrt.traverse((obj: Object3D) => {
      if (
        obj instanceof Mesh &&
        !Array.isArray(obj.material) &&
        obj.material?.userData?.uSelectiveEffectBufferMode
      ) {
        obj.material.userData.uSelectiveEffectBufferMode.value = 1;
        const mask = this.computeMaskForObject(obj);
        obj.material.userData.uEffectIdsMask.value = mask;
        this._nonEnhancedMeshes.push(obj);
      }
    });

    // Hide non-MRT scenes
    this._savedOpaqueVisible = this._scenes.opaque.visible;
    this._savedGlobeVisible = this._scenes.globe.visible;
    this._scenes.opaque.visible = false;
    this._scenes.globe.visible = false;
  }

  private disableSEBufferMode(): void {
    // Enhanced meshes
    for (const [_key, obj] of this._meshes) {
      if (isSelectiveEffectBufferMesh(obj)) {
        obj._setSelectiveEffectBufferMode(false, 0);
      }
    }

    // Non-enhanced meshes — use cache from enableSEBufferMode(), no traverse needed
    for (const mesh of this._nonEnhancedMeshes) {
      const mat = mesh.material;
      if (Array.isArray(mat)) continue;
      mat.userData.uSelectiveEffectBufferMode.value = 0;
      mat.userData.uEffectIdsMask.value = 0;
    }

    // Restore scene visibility
    this._scenes.opaque.visible = this._savedOpaqueVisible;
    this._scenes.globe.visible = this._savedGlobeVisible;
  }

  private computeMaskForObject(obj: Object3D): number {
    if (isSelectiveEffectBufferMesh(obj)) {
      return this._slotRegistry.computeMask(obj._getEffectIds());
    }
    const config = getSelectiveEffectConfig(obj);
    if (config) {
      return this._slotRegistry.computeMask(config.effectIds);
    }
    return 0;
  }

  public processRender(): void {
    // Skip entire pass when no effect slots are registered
    if (this._slotRegistry.size === 0) return;

    this._renderer.getClearColor(this._tempClearColor);
    const orgClearAlpha = this._renderer.getClearAlpha();

    this._renderer.setClearColor(0x000000, 0);

    this.enableSEBufferMode();

    // Single render to Selective Effect MRT (writes Emissive + EffectIds simultaneously)
    this._renderer.setRenderTarget(this.selectiveEffectMRT);
    this._renderer.clear();
    this._renderer.render(this._scenes.mrt, this._camera);

    this.disableSEBufferMode();

    this._renderer.setClearColor(this._tempClearColor, orgClearAlpha);
  }

  // --- Debug views ---

  private static readonly DEBUG_PANEL_WIDTH = 150;

  public enableEmissiveDebugView(enabled: boolean): void {
    if (enabled && !this.emissiveDebugCanvases) {
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

      const w = this.selectiveEffectMRT.width;
      const h = this.selectiveEffectMRT.height;
      const panelW = SelectiveEffectBufferPass.DEBUG_PANEL_WIDTH;

      const labels = ["Emissive RGB", "Emissive A (intensity)"];
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

      this._emissivePixelBuffer = new Float32Array(w * h * 4);
      this.emissiveDebugCanvases = { container, contexts, tempCtx };
    } else if (!enabled && this.emissiveDebugCanvases) {
      this.emissiveDebugCanvases.container.remove();
      this.emissiveDebugCanvases = undefined;
      this._emissivePixelBuffer = undefined;
    }
  }

  public enableEffectIdsDebugView(enabled: boolean): void {
    if (enabled && !this.effectIdsDebugCanvases) {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.bottom = "0px";
      container.style.left = "0px";
      container.style.background = "rgba(0,0,0,0.7)";
      container.style.padding = "2px";
      container.style.zIndex = "1000";
      document.body.appendChild(container);

      const w = this.selectiveEffectMRT.width;
      const h = this.selectiveEffectMRT.height;
      const panelW = 400;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${panelW}px`;
      canvas.style.height = "auto";
      canvas.style.display = "block";

      const labelEl = document.createElement("div");
      labelEl.textContent = "EffectIds (R=bitmask, HalfFloat)";
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

      this._effectIdsPixelBuffer = new Float32Array(w * h * 4);
      this.effectIdsDebugCanvases = { container, ctx, tempCtx };
    } else if (!enabled && this.effectIdsDebugCanvases) {
      this.effectIdsDebugCanvases.container.remove();
      this.effectIdsDebugCanvases = undefined;
      this._effectIdsPixelBuffer = undefined;
    }
  }

  public renderDebugView(): void {
    this.renderEmissiveDebugView();
    this.renderEffectIdsDebugView();
  }

  /**
   * Read pixels from a specific MRT attachment.
   * Three.js readRenderTargetPixels doesn't switch gl.readBuffer for MRT,
   * so we need to do it manually.
   */
  private readMRTAttachment(
    attachmentIndex: number,
    buffer: Float32Array,
  ): void {
    const width = this.selectiveEffectMRT.width;
    const height = this.selectiveEffectMRT.height;
    const gl = this._renderer.getContext() as WebGL2RenderingContext;

    // Bind the Selective Effect MRT framebuffer
    this._renderer.setRenderTarget(this.selectiveEffectMRT);

    // Switch readBuffer to the desired attachment
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachmentIndex);

    // Read pixels (HalfFloat → Float32 conversion handled by WebGL)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer);
  }

  private renderEmissiveDebugView(): void {
    if (!this.emissiveDebugCanvases || !this._emissivePixelBuffer) return;

    const width = this.selectiveEffectMRT.width;
    const height = this.selectiveEffectMRT.height;

    this.readMRTAttachment(0, this._emissivePixelBuffer);

    const { contexts, tempCtx } = this.emissiveDebugCanvases;

    // Panel 0: RGB (clamped to 0-255)
    {
      const imageData = tempCtx.createImageData(width, height);
      const data = imageData.data;
      for (let i = 0; i < width * height; i++) {
        const j = i * 4;
        data[j] = Math.min(
          255,
          Math.max(0, this._emissivePixelBuffer[j] * 255),
        );
        data[j + 1] = Math.min(
          255,
          Math.max(0, this._emissivePixelBuffer[j + 1] * 255),
        );
        data[j + 2] = Math.min(
          255,
          Math.max(0, this._emissivePixelBuffer[j + 2] * 255),
        );
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
        const v = Math.min(
          255,
          Math.max(0, this._emissivePixelBuffer[i * 4 + 3] * 255),
        );
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

  private renderEffectIdsDebugView(): void {
    if (!this.effectIdsDebugCanvases || !this._effectIdsPixelBuffer) return;

    const width = this.selectiveEffectMRT.width;
    const height = this.selectiveEffectMRT.height;

    this.readMRTAttachment(1, this._effectIdsPixelBuffer);

    const { ctx, tempCtx } = this.effectIdsDebugCanvases;
    const imageData = tempCtx.createImageData(width, height);
    const data = imageData.data;

    // Visualize bitmask: each bit → distinct color
    // bit 0=red, 1=green, 2=blue, 3=yellow, 4=cyan, 5=magenta, ...
    const BIT_COLORS = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [0, 255, 255],
      [255, 0, 255],
      [255, 128, 0],
      [128, 0, 255],
      [0, 255, 128],
      [255, 128, 128],
      [128, 255, 128],
    ];

    for (let i = 0; i < width * height; i++) {
      const mask = Math.round(this._effectIdsPixelBuffer[i * 4]);
      const j = i * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let bit = 0; bit < BIT_COLORS.length; bit++) {
        if ((mask & (1 << bit)) !== 0) {
          r = Math.min(255, r + BIT_COLORS[bit][0]);
          g = Math.min(255, g + BIT_COLORS[bit][1]);
          b = Math.min(255, b + BIT_COLORS[bit][2]);
        }
      }
      data[j] = r;
      data[j + 1] = g;
      data[j + 2] = b;
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

  setSize(width: number, height: number): void {
    this.selectiveEffectMRT.setSize(width, height);
    if (this._emissivePixelBuffer) {
      this._emissivePixelBuffer = new Float32Array(width * height * 4);
    }
    if (this._effectIdsPixelBuffer) {
      this._effectIdsPixelBuffer = new Float32Array(width * height * 4);
    }
  }

  dispose(): void {
    this.selectiveEffectMRT.dispose();
    this.emissiveDebugCanvases?.container.remove();
    this.emissiveDebugCanvases = undefined;
    this._emissivePixelBuffer = undefined;
    this.effectIdsDebugCanvases?.container.remove();
    this.effectIdsDebugCanvases = undefined;
    this._effectIdsPixelBuffer = undefined;
  }
}
