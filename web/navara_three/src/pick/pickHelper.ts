import type { Globe } from "@navara/core";
import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Object3D,
  Mesh,
  Material,
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
  private pickingTexture: WebGLRenderTarget;
  private pixelBuffer: Uint8Array;
  private _renderer: WebGLRenderer;
  private onPickCallback: (pickArr: number[]) => void;

  private debugBufferView?: BufferView;
  private debugRenderTarget?: WebGLRenderTarget;

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
    drapedFeatureMaterials: Map<string, Material>,
    onPickCallback: (pickArr: number[]) => void,
    inputBuffer: WebGLRenderTarget,
    globe: Globe,
    options?: PickHelperOptions,
  ) {
    super(scenes, camera, meshes, drapedFeatureMaterials, inputBuffer, globe, {
      disableShadow: true,
      allowTransparent: false,
    });

    this.element = element;
    this.pickingTexture = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.pixelBuffer = new Uint8Array(4);
    this._renderer = renderer;
    this.camera = camera;
    this.onPickCallback = onPickCallback;

    this.mouseMoved = false;
    this.mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    this.mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
    this.mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);

    if (options?.debug) {
      const width = this._renderer.getContext().drawingBufferWidth;
      const height = this._renderer.getContext().drawingBufferHeight;
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
    const pixelX = Math.floor(x * pixelRatio);
    const pixelY = Math.floor(y * pixelRatio);
    const pickingCoordX = pixelX + 0.5;
    const pickingCoordY = fullHeight - pixelY - 0.5; // Flip Y axis for WebGL
    const pickingCoord = new Vector2(pickingCoordX, pickingCoordY);

    this._camera.setViewOffset(
      fullWidth, // full width
      fullHeight, // full height
      pixelX, // rect x
      pixelY, // rect y (screen space Y for setViewOffset)
      1, // rect width
      1, // rect height
    );

    this.processRender(this.pickingTexture, pickingCoord);

    this._renderer.readRenderTargetPixels(
      this.pickingTexture,
      0, // x
      0, // y
      1, // width
      1, // height
      this.pixelBuffer,
    );

    this._renderer.setRenderTarget(null);
    this._camera.clearViewOffset();

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
