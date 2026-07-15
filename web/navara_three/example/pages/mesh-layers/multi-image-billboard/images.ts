/**
 * Procedural test images for the multi-image billboard example.
 *
 * Images are drawn on a canvas and returned as PNG data URLs, so the example
 * needs no binary assets and every size/aspect combination is easy to tweak.
 * Drawing is deterministic per index and results are cached, so a given index
 * always yields the same data URL — the billboard atlas dedupes by URL string,
 * meaning growing/shrinking the pool reuses atlas entries instead of packing
 * duplicates.
 */

export type TestImage = {
  url: string;
  width: number;
  height: number;
};

/** URL that always fails to decode — exercises the atlas' failed-load path. */
export const BROKEN_IMAGE_URL = "/this-image-does-not-exist.png";

// Deliberately extreme mix: tiny, large, wide, tall. The vertex shader derives
// each billboard's aspect ratio from its atlas rect, so non-square entries
// verify per-instance aspect handling; the size spread stresses the shelf
// allocator and forces the atlas to grow.
const SIZE_VARIANTS: readonly (readonly [number, number])[] = [
  [16, 16],
  [32, 32],
  [64, 64],
  [128, 128],
  [256, 256],
  [128, 32],
  [32, 128],
  [256, 64],
  [64, 256],
  [200, 50],
  [50, 200],
  [96, 48],
  [24, 96],
  [320, 160],
];

const createContext = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { canvas, ctx };
};

const drawTestImage = (
  index: number,
  width: number,
  height: number,
): string => {
  const { canvas, ctx } = createContext(width, height);

  // Golden-angle hue: adjacent indices get clearly distinct colors.
  const hue = (index * 137.508) % 360;

  // Rounded-rect body with transparent corners (exercises alpha/alphaTest).
  const radius = Math.min(width, height) * 0.2;
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, radius);
  ctx.fillStyle = `hsl(${hue}, 75%, 45%)`;
  ctx.fill();

  // Diagonal stripes make UV stretching or misalignment obvious.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  for (let x = -height; x < width; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, radius);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top-left marker: verifies orientation (flipY) survives the decode path.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(3, 3, Math.max(3, width * 0.08), Math.max(3, height * 0.08));

  if (width >= 48 && height >= 24) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontPx = Math.max(9, Math.min(height * 0.35, width / 7));
    ctx.font = `bold ${fontPx}px monospace`;
    ctx.fillText(`#${index} ${width}x${height}`, width / 2, height / 2);
  }

  return canvas.toDataURL("image/png");
};

const poolCache: TestImage[] = [];

/**
 * Returns `count` test images, cycling through the size variants. Previously
 * generated images are cached so resizing the pool is cheap and URL-stable.
 */
export const generateImagePool = (count: number): TestImage[] => {
  while (poolCache.length < count) {
    const index = poolCache.length;
    const [width, height] = SIZE_VARIANTS[index % SIZE_VARIANTS.length] ?? [
      64, 64,
    ];
    poolCache.push({ url: drawTestImage(index, width, height), width, height });
  }
  return poolCache.slice(0, count);
};

/**
 * Neutral gray image used as the material-level default `url`, so features
 * whose per-instance image is reset (`image: null`) are visually unmistakable.
 */
export const generateDefaultImage = (): string => {
  const size = 96;
  const { canvas, ctx } = createContext(size, size);

  ctx.beginPath();
  ctx.roundRect(1, 1, size - 2, size - 2, size * 0.2);
  ctx.fillStyle = "#555555";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 20px monospace";
  ctx.fillText("DEFAULT", size / 2, size / 2);

  return canvas.toDataURL("image/png");
};
