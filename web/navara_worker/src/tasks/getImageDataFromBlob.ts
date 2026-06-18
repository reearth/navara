/**
 * Decode a compressed image Blob into raw RGBA pixels entirely off the main
 * thread. Running `createImageBitmap` inside the worker keeps the (potentially
 * expensive) image decode off the main thread, which matters for DEM /
 * elevation tiles that stream in large numbers while panning and zooming.
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
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  } finally {
    bitmap.close();
  }
}
