export async function getImageDataFromImageBitmap(
  img: ImageBitmap,
  canvas: OffscreenCanvas,
): Promise<Uint8ClampedArray> {
  try {
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("failed to get context of canvas");
    } else {
      context.drawImage(img, 0, 0);
    }
    const data = context.getImageData(0, 0, img.width, img.height).data;
    return data;
  } finally {
    // The bitmap is transferred into this worker; close it so its backing
    // store is released immediately instead of waiting for GC.
    img.close();
  }
}
