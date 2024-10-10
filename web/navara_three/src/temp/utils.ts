export function isWorker() {
  return typeof self !== "undefined" && self.document === undefined;
}

export const PI = Math.PI;
export const PI_4 = Math.PI / 4;
export const RADIANS_TO_DEGREES = 180 / PI;
export const DEGREES_TO_RADIANS = PI / 180;
export const TILE_SIZE = 256;

export type Extent = {
  east: number;
  west: number;
  north: number;
  south: number;
};

export function isExtentIntersected(a: Extent, b: Extent): boolean {
  return (
    a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south
  );
}

// Extent is in degrees
export function tileExtent(x: number, y: number, z: number): Extent {
  const w1 = tileXYZToWebMercatorWorld(x, y, z);
  const w2 = tileXYZToWebMercatorWorld(x + 1, y + 1, z);
  const p1 = webMercatorWorldToWestNorthLngLat(w1);
  const p2 = webMercatorWorldToWestNorthLngLat(w2);
  return {
    east: Math.max(p1[0], p2[0]),
    west: Math.min(p1[0], p2[0]),
    north: Math.max(p1[1], p2[1]),
    south: Math.min(p1[1], p2[1]),
  };
}

// x and y shoud be normalized to the range [0, 1]
// result is [lng, lat] in degrees
export function webMercatorWorldToWestNorthLngLat([x, y]: number[]): [
  number,
  number,
] {
  const lng = x * (2 * PI) - PI;
  const phi = PI - 2 * PI * y; // y=0 -> PI, y=1 -> -PI
  const lat = 2 * (Math.atan(Math.exp(phi)) - PI_4);
  return [lng * RADIANS_TO_DEGREES, lat * RADIANS_TO_DEGREES];
}

// result is normalized to the range [0, 1]
export function tileXYZToWebMercatorWorld(
  x: number,
  y: number,
  z: number,
): [number, number] {
  const n = Math.pow(2, z);
  const x2 = x / n;
  const y2 = y / n;
  return [x2, y2];
}

export function getTileUrl(
  url: string,
  x: number,
  y: number,
  z: number,
): string {
  return url.replace(/\{x\}|\{y\}|\{z\}/g, (match) => {
    if (match === "{x}") return x.toString();
    if (match === "{y}") return y.toString();
    if (match === "{z}") return z.toString();
    return match;
  });
}

export type TraverseTilesOptions = {
  extent?: Extent;
  extentMode?: "include" | "exclude";
};

export function traverseTiles(
  z: number,
  fn: (x: number, y: number, z: number) => void,
  opts?: TraverseTilesOptions,
) {
  const n = 2 ** z;

  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      if (opts?.extent) {
        const te = tileExtent(x, y, z);
        if (!te) continue;

        const intersected = isExtentIntersected(te, opts.extent);
        if (intersected === (opts.extentMode === "exclude")) continue;
      }

      fn(x, y, z);
    }
  }
}

export function forEachTilesAsync(
  z: number,
  fn: (x: number, y: number, z: number) => PromiseLike<void> | void,
  opts?: TraverseTilesOptions,
): Promise<void> {
  const p = Promise.resolve();
  traverseTiles(
    z,
    (x, y, z) => {
      p.then(() => fn(x, y, z));
    },
    opts,
  );
  return p;
}
