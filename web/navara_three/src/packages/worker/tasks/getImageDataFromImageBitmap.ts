export async function getImageDataFromImageBitmap(
  img: ImageBitmap,
  canvas: OffscreenCanvas,
): Promise<Uint8ClampedArray> {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("failed to get context of canvas");
  } else {
    context.drawImage(img, 0, 0);
  }
  const data = context.getImageData(0, 0, img.height, img.width).data;
  return data;
}
