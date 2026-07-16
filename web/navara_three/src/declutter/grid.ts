/**
 * Uniform screen-space grid for label collision (the same structure MapLibre
 * uses for symbol placement). Boxes are inserted greedily in priority order:
 * `insertIfFree` either claims the space and returns true, or reports the
 * collision and leaves the grid untouched.
 *
 * The grid tracks a margin beyond the viewport so labels just off the edge
 * still compete for space — otherwise panning would let an off-screen label
 * "win" the moment it enters, popping its on-screen neighbor out.
 */
export class ScreenCollisionGrid {
  private _cellSize: number;
  private _margin: number;

  private _width = 0;
  private _height = 0;
  private _cols = 0;
  private _rows = 0;
  /** Per-cell lists of indices into `_boxes` (4 numbers per box). */
  private _cells: number[][] = [];
  private _boxes: number[] = [];

  constructor(cellSize = 64, margin = 128) {
    this._cellSize = cellSize;
    this._margin = margin;
  }

  /** Viewport margin in pixels within which boxes still compete. */
  get margin(): number {
    return this._margin;
  }

  /** Clear all boxes and resize the grid to the given viewport (CSS px). */
  reset(width: number, height: number): void {
    this._width = width;
    this._height = height;
    const cols = Math.max(
      1,
      Math.ceil((width + 2 * this._margin) / this._cellSize),
    );
    const rows = Math.max(
      1,
      Math.ceil((height + 2 * this._margin) / this._cellSize),
    );

    if (cols !== this._cols || rows !== this._rows) {
      this._cols = cols;
      this._rows = rows;
      this._cells = Array.from({ length: cols * rows }, () => []);
    } else {
      for (const cell of this._cells) cell.length = 0;
    }
    this._boxes.length = 0;
  }

  /**
   * Claim `[minX, maxX] × [minY, maxY]` (screen px, y-down) if it does not
   * overlap any previously claimed box. A box entirely outside the tracked
   * area (viewport + margin) is reported free without claiming cells: nothing
   * it could occlude is visible.
   */
  insertIfFree(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    const m = this._margin;
    if (
      maxX <= -m ||
      minX >= this._width + m ||
      maxY <= -m ||
      minY >= this._height + m
    ) {
      return true;
    }

    const c0 = this._colOf(minX);
    const c1 = this._colOf(maxX);
    const r0 = this._rowOf(minY);
    const r1 = this._rowOf(maxY);

    const boxes = this._boxes;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this._cells[r * this._cols + c];
        for (const b of cell) {
          // Strict inequalities: exactly touching boxes do not collide.
          if (
            minX < boxes[b + 2] &&
            maxX > boxes[b] &&
            minY < boxes[b + 3] &&
            maxY > boxes[b + 1]
          ) {
            return false;
          }
        }
      }
    }

    const idx = boxes.length;
    boxes.push(minX, minY, maxX, maxY);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        this._cells[r * this._cols + c].push(idx);
      }
    }
    return true;
  }

  private _colOf(x: number): number {
    const c = Math.floor((x + this._margin) / this._cellSize);
    return Math.min(Math.max(c, 0), this._cols - 1);
  }

  private _rowOf(y: number): number {
    const r = Math.floor((y + this._margin) / this._cellSize);
    return Math.min(Math.max(r, 0), this._rows - 1);
  }
}
