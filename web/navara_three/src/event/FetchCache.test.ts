import { describe, expect, test } from "vitest";
import { FetchCache } from "./FetchCache";

describe("FetchCache", () => {
  test("getOrCreateFetchPromise creates new promise", async () => {
    const cache = new FetchCache();
    const url = "https://example.com/tile.png";
    let fetchCalled = 0;

    const fetcher = async () => {
      fetchCalled++;
    };

    const promise = cache.getOrCreateFetchPromise(url, fetcher);
    expect(cache.isPending(url)).toBe(true);

    await promise;
    expect(fetchCalled).toBe(1);
    expect(cache.isPending(url)).toBe(false);
  });

  test("getOrCreateFetchPromise deduplicates concurrent requests", async () => {
    const cache = new FetchCache();
    const url = "https://example.com/tile.png";
    let fetchCalled = 0;

    const fetcher = async () => {
      fetchCalled++;
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    // Start two concurrent requests
    const promise1 = cache.getOrCreateFetchPromise(url, fetcher);
    const promise2 = cache.getOrCreateFetchPromise(url, fetcher);

    // Should be the same promise
    expect(promise1).toBe(promise2);

    await Promise.all([promise1, promise2]);
    expect(fetchCalled).toBe(1); // Only called once
  });

  test("different URLs get different promises", async () => {
    const cache = new FetchCache();
    const url1 = "https://example.com/tile1.png";
    const url2 = "https://example.com/tile2.png";
    let fetch1Called = 0;
    let fetch2Called = 0;

    const promise1 = cache.getOrCreateFetchPromise(url1, async () => {
      fetch1Called++;
    });
    const promise2 = cache.getOrCreateFetchPromise(url2, async () => {
      fetch2Called++;
    });

    expect(promise1).not.toBe(promise2);

    await Promise.all([promise1, promise2]);
    expect(fetch1Called).toBe(1);
    expect(fetch2Called).toBe(1);
  });

  test("dispose clears all pending requests", () => {
    const cache = new FetchCache();
    const url = "https://example.com/tile.png";

    cache.getOrCreateFetchPromise(url, async () => {});
    expect(cache.isPending(url)).toBe(true);

    cache.dispose();
    expect(cache.isPending(url)).toBe(false);
  });

  test("promise cleanup after completion", async () => {
    const cache = new FetchCache();
    const url = "https://example.com/tile.png";

    const promise = cache.getOrCreateFetchPromise(url, async () => {});
    expect(cache.isPending(url)).toBe(true);

    await promise;
    expect(cache.isPending(url)).toBe(false);

    // New request should create a new promise
    let secondCallExecuted = false;
    const promise2 = cache.getOrCreateFetchPromise(url, async () => {
      secondCallExecuted = true;
    });

    expect(promise2).not.toBe(promise);
    await promise2;
    expect(secondCallExecuted).toBe(true);
  });
});
