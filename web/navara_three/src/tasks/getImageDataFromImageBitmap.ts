import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

export function getImageDataFromImageBitmap(
  img: ImageBitmap,
  canvas: OffscreenCanvas,
): Promise<Uint8ClampedArray> {
  return queueTask("getImageDataFromImageBitmap", [img, canvas], {
    transfer: [img, canvas],
  });
}
