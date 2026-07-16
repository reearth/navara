import { describe, expect, it } from "vitest";

import { ScreenCollisionGrid } from "./grid";

describe("ScreenCollisionGrid", () => {
  it("places non-overlapping boxes", () => {
    const grid = new ScreenCollisionGrid();
    grid.reset(800, 600);

    expect(grid.insertIfFree(10, 10, 50, 30)).toBe(true);
    expect(grid.insertIfFree(60, 10, 100, 30)).toBe(true);
    expect(grid.insertIfFree(10, 40, 50, 60)).toBe(true);
  });

  it("rejects an overlapping box and leaves the grid untouched", () => {
    const grid = new ScreenCollisionGrid();
    grid.reset(800, 600);

    expect(grid.insertIfFree(10, 10, 50, 30)).toBe(true);
    expect(grid.insertIfFree(40, 20, 80, 40)).toBe(false);
    // The rejected box claimed nothing: a box overlapping only the rejected
    // area is still free.
    expect(grid.insertIfFree(55, 25, 80, 40)).toBe(true);
  });

  it("treats exactly touching boxes as non-colliding", () => {
    const grid = new ScreenCollisionGrid();
    grid.reset(800, 600);

    expect(grid.insertIfFree(10, 10, 50, 30)).toBe(true);
    expect(grid.insertIfFree(50, 10, 90, 30)).toBe(true);
    expect(grid.insertIfFree(10, 30, 50, 50)).toBe(true);
  });

  it("detects collisions across cell boundaries", () => {
    const grid = new ScreenCollisionGrid(64);
    grid.reset(800, 600);

    // Spans several 64px cells.
    expect(grid.insertIfFree(30, 30, 300, 90)).toBe(true);
    // Overlaps only its far end, in a different cell than the box's origin.
    expect(grid.insertIfFree(280, 50, 320, 70)).toBe(false);
  });

  it("competes within the margin but not beyond it", () => {
    const grid = new ScreenCollisionGrid(64, 128);
    grid.reset(800, 600);

    // Just off the left edge, inside the margin: claims space.
    expect(grid.insertIfFree(-60, 10, -10, 30)).toBe(true);
    expect(grid.insertIfFree(-40, 10, 20, 30)).toBe(false);

    // Entirely beyond the margin: free, and claims nothing.
    expect(grid.insertIfFree(-500, 10, -400, 30)).toBe(true);
    expect(grid.insertIfFree(-480, 10, -420, 30)).toBe(true);
  });

  it("reset clears previously claimed boxes", () => {
    const grid = new ScreenCollisionGrid();
    grid.reset(800, 600);
    expect(grid.insertIfFree(10, 10, 50, 30)).toBe(true);

    grid.reset(800, 600);
    expect(grid.insertIfFree(10, 10, 50, 30)).toBe(true);
  });
});
