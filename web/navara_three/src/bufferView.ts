import type { WebGLRenderer, WebGLRenderTarget } from "three";

export class BufferView {
  canvas: HTMLCanvasElement;
  canvasForImage: HTMLCanvasElement;
  constructor(
    width: number,
    height: number,
    {
      styleWidth = "300px",
      styleHeight = "auto",
    }: { styleWidth?: string; styleHeight?: string } = {},
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = styleWidth;
    this.canvas.style.height = styleHeight;
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0px";
    this.canvas.style.left = "0px";
    document.body.appendChild(this.canvas);

    this.canvasForImage = document.createElement("canvas");
    this.canvasForImage.width = width;
    this.canvasForImage.height = height;
  }

  render(renderer: WebGLRenderer, renderTarget: WebGLRenderTarget) {
    const width = renderTarget.width;
    const height = renderTarget.height;
    const pixelBuffer = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixelBuffer,
    );
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas before drawing (fix for stale content from previous frames)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixelBuffer);

    const tempCtx = this.canvasForImage.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.translate(0, height);
    ctx.scale(1, -1);
    ctx.drawImage(
      this.canvasForImage,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  dispose() {
    this.canvas.remove();
    this.canvasForImage.remove();
  }
}
