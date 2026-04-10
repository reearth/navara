import type { Globe } from "@navara/core";
import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Object3D,
  Mesh,
  Scene,
  RGBAFormat,
  Color,
  Vector2,
} from "three";

import { BufferView } from "../bufferView";
import { isPickableMesh } from "../mesh/pickableMesh";
import { CustomRenderPass } from "../passes";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

export type PickHelperOptions = {
  debug: boolean;
};

export class PickHelper extends CustomRenderPass {
  private element: HTMLElement;
  private pixelBuffer: Uint8Array;
  private _renderer: WebGLRenderer;
  private onPickCallback: (pickArr: number[]) => void;
  private _meshes: MeshCache;

  private debugBufferView?: BufferView;
  private debugRenderTarget?: WebGLRenderTarget;
  /** Full-size render target for picking (single color attachment). */
  private pickRenderTarget: WebGLRenderTarget;

  private mouseMoved: boolean;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseMoveHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;

  constructor(
    element: HTMLElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    onPickCallback: (pickArr: number[]) => void,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
    options?: PickHelperOptions,
  ) {
    super(scenes, camera, inputBuffer, globe, {
      disableShadow: true,
      allowTransparent: false,
    });

    this.element = element;
    this.pixelBuffer = new Uint8Array(4);
    this._renderer = renderer;
    this.camera = camera;
    this.onPickCallback = onPickCallback;

    this.mouseMoved = false;
    this.mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    this.mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
    this.mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);

    this._meshes = meshes;

    const width = this._renderer.getContext().drawingBufferWidth;
    const height = this._renderer.getContext().drawingBufferHeight;

    this.pickRenderTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });

    if (options?.debug) {
      this.debugBufferView = new BufferView(width, height);
      this.debugRenderTarget = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: true,
      });
    }
  }

  private onMouseDown(_event: MouseEvent) {
    this.mouseMoved = false;
  }

  private onMouseMove(_event: MouseEvent) {
    this.mouseMoved = true;
  }

  private onMouseUp(event: MouseEvent) {
    if (!this.mouseMoved) {
      this.onMouseClick(event);
    }
  }

  enablePick(bPick: boolean) {
    if (bPick) {
      this.element.addEventListener("mousedown", this.mouseDownHandler);
      this.element.addEventListener("mousemove", this.mouseMoveHandler);
      this.element.addEventListener("mouseup", this.mouseUpHandler);
    } else {
      this.element.removeEventListener("mousedown", this.mouseDownHandler);
      this.element.removeEventListener("mousemove", this.mouseMoveHandler);
      this.element.removeEventListener("mouseup", this.mouseUpHandler);
    }
  }

  private traverseModel(obj: Object3D, callfunc: (mesh: Mesh) => void) {
    if (obj instanceof Mesh) {
      callfunc(obj);
    }

    if (Array.isArray(obj.children) && obj.children.length > 0) {
      obj.children.forEach((child) => {
        this.traverseModel(child, callfunc);
      });
    }
  }

  private togglePickable(pickable: boolean, pickingCoord?: Vector2) {
    for (const [_key, obj] of this._meshes) {
      if (isPickableMesh(obj)) {
        obj._setPickable(pickable, pickingCoord);
      }
    }

    // Since SkyMesh renders fullscreen quad plane, and it shows just black, this scene should be invisible.
    // We should support picking in this scene in the future.
    this._scenes.opaque.visible = !pickable;
  }

  public processRender(target: WebGLRenderTarget, pickingCoord?: Vector2) {
    const orgClearColor = new Color();
    this._renderer.getClearColor(orgClearColor);

    this._renderer.setClearColor(0x000000);

    this.togglePickable(true, pickingCoord);

    this.render(this._renderer, target, null);

    this.togglePickable(false);

    this._renderer.setClearColor(orgClearColor);
  }

  protected _renderWithWorld(renderer: WebGLRenderer, scene: Scene) {
    renderer.render(scene, this._camera);
  }

  override setSize(width: number, height: number) {
    super.setSize(width, height);

    // pickRenderTarget must match the drawingBuffer (device-pixel) size
    // because onMouseClick reads pixels using drawingBuffer coordinates.
    const dbWidth = this._renderer.getContext().drawingBufferWidth;
    const dbHeight = this._renderer.getContext().drawingBufferHeight;

    this.pickRenderTarget.setSize(dbWidth, dbHeight);
    this.debugRenderTarget?.setSize(dbWidth, dbHeight);
    if (this.debugBufferView) {
      this.debugBufferView.canvas.width = dbWidth;
      this.debugBufferView.canvas.height = dbHeight;
      this.debugBufferView.canvasForImage.width = dbWidth;
      this.debugBufferView.canvasForImage.height = dbHeight;
    }
  }

  public renderDebugCanvas() {
    if (!this.debugBufferView || !this.debugRenderTarget) return;

    this.processRender(this.debugRenderTarget);

    this.debugBufferView.render(this._renderer, this.debugRenderTarget);
  }

  private onMouseClick(event: MouseEvent) {
    const rect = this.element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pixelRatio = this._renderer.getPixelRatio();
    const fullWidth = this._renderer.getContext().drawingBufferWidth;
    const fullHeight = this._renderer.getContext().drawingBufferHeight;

    // Calculate pixel-space coordinates matching gl_FragCoord convention (pixel centers at 0.5, 1.5, 2.5, ...)
    // Clamp to valid viewport bounds to handle edge cases where rounding puts us outside [0, width-1] or [0, height-1]
    const pixelX = Math.max(
      0,
      Math.min(Math.floor(x * pixelRatio), fullWidth - 1),
    );
    const pixelY = Math.max(
      0,
      Math.min(Math.floor(y * pixelRatio), fullHeight - 1),
    );
    const pickingCoordX = pixelX + 0.5;
    const pickingCoordY = fullHeight - pixelY - 0.5; // Flip Y axis for WebGL
    const pickingCoord = new Vector2(pickingCoordX, pickingCoordY);

    // Render the full pick scene without setViewOffset, then read the
    // specific pixel directly from the gbufferRenderTarget.
    //
    // Why not setViewOffset?
    // setViewOffset(1x1) creates an extreme projection zoom (e.g. 3024x).
    // LineMaterial (used by Line2/SmoothLine) and custom ShaderMaterials
    // (used by ArcLine) expand geometry in the vertex shader using
    // screen-space calculations. With extreme zoom, all expanded vertices
    // project outside clip space [-1,1] and the GPU clips them entirely,
    // even though the line visually passes through the picked pixel.
    //
    // Instead, render the full scene into a single-attachment render target
    // and read the exact pixel from it.
    this.processRender(this.pickRenderTarget, pickingCoord);

    // Read the picked pixel from the single-attachment pickRenderTarget.
    // readRenderTargetPixels uses WebGL convention: Y=0 at bottom.
    const readY = fullHeight - 1 - pixelY;
    this._renderer.readRenderTargetPixels(
      this.pickRenderTarget,
      pixelX,
      readY,
      1, // width
      1, // height
      this.pixelBuffer,
    );

    this._renderer.setRenderTarget(null);

    const batchId =
      (this.pixelBuffer[0] << 16) +
      (this.pixelBuffer[1] << 8) +
      this.pixelBuffer[2];

    const pickArr = batchId > 0 ? [batchId] : [];
    this.onPickCallback(pickArr);
  }

  public dispose() {
    this.enablePick(false);
  }
}
