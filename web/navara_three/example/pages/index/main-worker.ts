import type { Message } from "./worker";
import Worker from "./worker?worker";

const worker = new Worker();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas element not found");

const offscreenCanvas = canvas.transferControlToOffscreen();

worker.postMessage(
  {
    type: "init",
    canvas: offscreenCanvas,
    width: canvas.offsetWidth,
    height: canvas.offsetHeight,
    pixelRatio: window.devicePixelRatio,
  } satisfies Message,
  [offscreenCanvas],
);
window.addEventListener("resize", () => {
  worker.postMessage({
    type: "resize",
    width: canvas.offsetWidth,
    height: canvas.offsetHeight,
  } satisfies Message);
});
