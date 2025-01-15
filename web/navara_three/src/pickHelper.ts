import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Scene,
} from "three";

export class PickHelper {
  private element: HTMLElement;
  private pickingTexture: WebGLRenderTarget;
  private pixelBuffer: Uint8Array;
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;
  private pickScene: Scene;
  private onPickCallback: (pickArr: number[]) => void;

  mousedownHandler: (event: MouseEvent) => void;

  constructor(
    element: HTMLElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    pickScene: Scene,
    onPickCallback: (pickArr: number[]) => void,
  ) {
    this.element = element;
    this.pickingTexture = new WebGLRenderTarget(1, 1);
    this.pixelBuffer = new Uint8Array(4);
    this.renderer = renderer;
    this.camera = camera;
    this.pickScene = pickScene;
    this.onPickCallback = onPickCallback;

    this.mousedownHandler = (event: MouseEvent) => this.onMouseDown(event);
    element.addEventListener("mousedown", this.mousedownHandler);
  }

  onMouseDown(event: MouseEvent) {
    const x = event.clientX;
    const y = event.clientY;

    const pixelRatio = this.renderer.getPixelRatio();
    this.camera.setViewOffset(
      this.renderer.getContext().drawingBufferWidth, // full width
      this.renderer.getContext().drawingBufferHeight, // full top
      (x * pixelRatio) | 0, // rect x
      (y * pixelRatio) | 0, // rect y
      1, // rect width
      1, // rect height
    );

    this.renderer.setRenderTarget(this.pickingTexture);
    this.renderer.clearDepth();
    this.renderer.render(this.pickScene, this.camera);

    this.renderer.readRenderTargetPixels(
      this.pickingTexture,
      0, // x
      0, // y
      1, // width
      1, // height
      this.pixelBuffer,
    );

    this.renderer.setRenderTarget(null);
    this.camera.clearViewOffset();

    const batchId =
      (this.pixelBuffer[0] << 16) +
      (this.pixelBuffer[1] << 8) +
      this.pixelBuffer[2];
    if (batchId > 0) {
      this.onPickCallback([batchId]);
    } else {
      this.onPickCallback([]);
    }
  }

  dispose() {
    this.element.removeEventListener("mousedown", this.mousedownHandler);
  }
}
