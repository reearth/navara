import { describe, expect, it } from "vitest";

import { InMemoryBufferStore } from "./inMemoryBufferStore";

describe("InMemoryBufferStore", () => {
  it("tracks totalBytes and count on set/take/delete", () => {
    const store = new InMemoryBufferStore();
    expect(store.totalBytes).toBe(0);
    expect(store.count).toBe(0);

    const a = new Float32Array(10); // 40 bytes
    store.set(1, a);
    expect(store.totalBytes).toBe(40);
    expect(store.count).toBe(1);
    expect(store.get(1)).toBe(a);

    const b = new Uint8Array(5); // 5 bytes
    store.set(2, b);
    expect(store.totalBytes).toBe(45);
    expect(store.count).toBe(2);

    // take returns and removes.
    expect(store.take(1)).toBe(a);
    expect(store.get(1)).toBeUndefined();
    expect(store.totalBytes).toBe(5);
    expect(store.count).toBe(1);

    store.delete(2);
    expect(store.totalBytes).toBe(0);
    expect(store.count).toBe(0);
  });

  it("re-accounts bytes when a handle is replaced", () => {
    const store = new InMemoryBufferStore();
    store.set(1, new Uint32Array(10)); // 40 bytes
    expect(store.totalBytes).toBe(40);
    store.set(1, new Uint32Array(2)); // 8 bytes
    expect(store.totalBytes).toBe(8);
    expect(store.count).toBe(1);
  });

  it("take/delete on a missing handle is a no-op", () => {
    const store = new InMemoryBufferStore();
    store.set(1, new Uint8Array(3));
    expect(store.take(999)).toBeUndefined();
    store.delete(999);
    expect(store.totalBytes).toBe(3);
    expect(store.count).toBe(1);
  });

  it("clear drops everything", () => {
    const store = new InMemoryBufferStore();
    store.set(1, new Float64Array(4)); // 32 bytes
    store.set(2, new Uint8Array(8));
    store.clear();
    expect(store.totalBytes).toBe(0);
    expect(store.count).toBe(0);
    expect(store.get(1)).toBeUndefined();
  });
});
