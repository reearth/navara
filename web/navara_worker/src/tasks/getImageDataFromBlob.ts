import { transfer } from "..";

/**
 * Decode a compressed image Blob into raw RGBA pixels entirely off the main
 * thread. Running `createImageBitmap` inside the worker keeps the (potentially
 * expensive) image decode off the main thread, which matters for DEM /
 * elevation tiles that stream in large numbers while panning and zooming.
 *
 * The pixel buffer is transferred back to the caller (not structured-cloned),
 * so the worker→main hand-off moves ownership instead of copying width*height*4
 * bytes. The Blob argument is already cheap to pass in: its structured clone
 * shares the immutable backing bytes by reference, and Blob is not transferable.
 */
export async function getImageDataFromBlob(
  blob: Blob,
): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("failed to get context of canvas");
    }
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    return transfer(data, [data.buffer]);
  } finally {
    bitmap.close();
  }
}
