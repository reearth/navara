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
    this.canvas.style.zIndex = "1000";
    this.canvas.style.pointerEvents = "none";
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
    this.drawPixels(pixelBuffer, width, height);
  }

  /**
   * Render from raw pixel data (Uint8Array RGBA).
   * Use this for HalfFloat MRT attachments where readRenderTargetPixels doesn't work.
   */
  renderFromPixels(pixels: Uint8Array, width: number, height: number) {
    this.drawPixels(pixels, width, height);
  }

  private drawPixels(pixelBuffer: Uint8Array, width: number, height: number) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas before drawing (fix for stale content from previous frames)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Resize temp canvas to match source data
    if (
      this.canvasForImage.width !== width ||
      this.canvasForImage.height !== height
    ) {
      this.canvasForImage.width = width;
      this.canvasForImage.height = height;
    }

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixelBuffer);

    const tempCtx = this.canvasForImage.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);

    // Flip Y and scale from source size to display canvas size
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.translate(0, ch);
    ctx.scale(1, -1);
    ctx.drawImage(this.canvasForImage, 0, 0, cw, ch);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  dispose() {
    this.canvas.remove();
    this.canvasForImage.remove();
  }
}
