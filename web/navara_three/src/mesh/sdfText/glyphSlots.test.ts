import { describe, expect, it } from "vitest";

import { GlyphSlotAllocator, capacityFor } from "./glyphSlots";

describe("capacityFor", () => {
  it("floors at the minimum run size", () => {
    expect(capacityFor(0)).toBe(4);
    expect(capacityFor(1)).toBe(4);
    expect(capacityFor(4)).toBe(4);
  });

  it("rounds up to the next power of two", () => {
    expect(capacityFor(5)).toBe(8);
    expect(capacityFor(8)).toBe(8);
    expect(capacityFor(9)).toBe(16);
    expect(capacityFor(1000)).toBe(1024);
    expect(capacityFor(1024)).toBe(1024);
    expect(capacityFor(1025)).toBe(2048);
  });
});

describe("GlyphSlotAllocator", () => {
  it("hands out non-overlapping runs and tracks the high-water mark", () => {
    const a = new GlyphSlotAllocator();
    expect(a.highWater).toBe(0);

    const first = a.alloc(3); // → capacity 4
    const second = a.alloc(10); // → capacity 16

    expect(first).toEqual({ start: 0, capacity: 4 });
    expect(second).toEqual({ start: 4, capacity: 16 });
    expect(a.highWater).toBe(20);
  });

  // The core of the design: a label whose text changes length must keep its
  // slots so the update is an in-place write, not a buffer rebuild.
  describe("realloc within a size class", () => {
    it("keeps the same run when the glyph count stays in class", () => {
      const a = new GlyphSlotAllocator();
      const run = a.alloc(5); // capacity 8
      const after = a.realloc(run, 7);

      expect(after).toBe(run);
      expect(a.highWater).toBe(8);
    });

    it("keeps the same run when the text gets shorter", () => {
      const a = new GlyphSlotAllocator();
      const run = a.alloc(8); // capacity 8
      const after = a.realloc(run, 6);

      expect(after).toBe(run);
      expect(a.highWater).toBe(8);
    });

    it("does not shrink below the minimum class", () => {
      const a = new GlyphSlotAllocator();
      const run = a.alloc(4);
      // "ab" → "a" stays in the floor class, so nothing moves.
      expect(a.realloc(run, 1)).toBe(run);
      expect(a.highWater).toBe(4);
    });
  });

  describe("realloc across size classes", () => {
    it("moves the run and recycles the old slots", () => {
      const a = new GlyphSlotAllocator();
      const run = a.alloc(4); // capacity 4 at 0
      const grown = a.realloc(run, 9); // needs capacity 16

      expect(grown.capacity).toBe(16);
      expect(grown.start).not.toBe(run.start);
      expect(a.highWater).toBe(20);

      // The vacated capacity-4 run is reusable.
      expect(a.alloc(4)).toEqual({ start: 0, capacity: 4 });
      expect(a.highWater).toBe(20);
    });

    it("reuses a freed run of the matching class before growing", () => {
      const a = new GlyphSlotAllocator();
      const first = a.alloc(8);
      a.alloc(8);
      expect(a.highWater).toBe(16);

      a.free(first);
      expect(a.alloc(6)).toEqual({ start: first.start, capacity: 8 });
      expect(a.highWater).toBe(16);
    });

    it("does not serve a request from a different class's free list", () => {
      const a = new GlyphSlotAllocator();
      a.free(a.alloc(4));
      expect(a.highWater).toBe(4);

      // A capacity-16 request can't use the freed capacity-4 run.
      expect(a.alloc(16)).toEqual({ start: 4, capacity: 16 });
      expect(a.highWater).toBe(20);
    });
  });

  it("allocates a fresh run when reallocating from null", () => {
    const a = new GlyphSlotAllocator();
    expect(a.realloc(null, 2)).toEqual({ start: 0, capacity: 4 });
  });

  it("reset clears the free lists and the high-water mark", () => {
    const a = new GlyphSlotAllocator();
    a.free(a.alloc(8));
    a.reset();

    expect(a.highWater).toBe(0);
    expect(a.alloc(8)).toEqual({ start: 0, capacity: 8 });
  });

  it("never overlaps runs across a churn of allocs, frees and reallocs", () => {
    const a = new GlyphSlotAllocator();
    const live = new Map<number, { start: number; capacity: number }>();

    // Deterministic pseudo-random churn — a cheap stand-in for the real
    // workload where labels appear, change text and disappear.
    let seed = 42;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let step = 0; step < 500; step++) {
      const id = next(40);
      const existing = live.get(id);
      const op = next(3);

      if (op === 0 && existing) {
        a.free(existing);
        live.delete(id);
      } else {
        live.set(id, a.realloc(existing ?? null, 1 + next(30)));
      }

      // Every live run must stay inside the high-water mark and disjoint.
      const occupied = new Set<number>();
      for (const run of live.values()) {
        expect(run.start + run.capacity).toBeLessThanOrEqual(a.highWater);
        for (let s = run.start; s < run.start + run.capacity; s++) {
          expect(occupied.has(s)).toBe(false);
          occupied.add(s);
        }
      }
    }
  });
});
