import type { Promise } from "@navara/worker";

import { queueTask } from "./queueTask";

/**
 * Decode a compressed image Blob into raw RGBA pixels on a worker thread.
 * The Blob is cheap to clone across the worker boundary (it references
 * immutable backing storage), so the whole decode — including
 * `createImageBitmap` — stays off the main thread.
 */
export function getImageDataFromBlob(blob: Blob): Promise<Uint8ClampedArray> {
  return queueTask("getImageDataFromBlob", [blob]);
}
