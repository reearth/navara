import { describe, it, expect, beforeEach } from "vitest";

import { LRUMap } from "./LRUMap";

describe("LRUMap", () => {
  let lru: LRUMap<string, number>;

  beforeEach(() => {
    lru = new LRUMap<string, number>(3);
  });

  describe("set and get", () => {
    it("should store and retrieve values", () => {
      lru.set("a", 1);
      expect(lru.get("a")).toBe(1);
    });

    it("should return undefined for missing keys", () => {
      expect(lru.get("missing")).toBeUndefined();
    });

    it("should overwrite existing keys", () => {
      lru.set("a", 1);
      lru.set("a", 2);
      expect(lru.get("a")).toBe(2);
      expect(lru.size).toBe(1);
    });
  });

  describe("eviction", () => {
    it("should evict the least recently used entry when exceeding maxSize", () => {
      lru.set("a", 1);
      lru.set("b", 2);
      lru.set("c", 3);
      lru.set("d", 4); // should evict "a"

      expect(lru.has("a")).toBe(false);
      expect(lru.get("b")).toBe(2);
      expect(lru.get("c")).toBe(3);
      expect(lru.get("d")).toBe(4);
      expect(lru.size).toBe(3);
    });

    it("should refresh entry on get, preventing eviction", () => {
      lru.set("a", 1);
      lru.set("b", 2);
      lru.set("c", 3);

      lru.get("a"); // refresh "a", making "b" the oldest

      lru.set("d", 4); // should evict "b"

      expect(lru.has("a")).toBe(true);
      expect(lru.has("b")).toBe(false);
      expect(lru.has("d")).toBe(true);
    });

    it("should refresh entry on set with existing key", () => {
      lru.set("a", 1);
      lru.set("b", 2);
      lru.set("c", 3);

      lru.set("a", 10); // refresh "a", making "b" the oldest

      lru.set("d", 4); // should evict "b"

      expect(lru.get("a")).toBe(10);
      expect(lru.has("b")).toBe(false);
    });
  });

  describe("has", () => {
    it("should return true for existing keys", () => {
      lru.set("a", 1);
      expect(lru.has("a")).toBe(true);
    });

    it("should return false for missing keys", () => {
      expect(lru.has("a")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should remove an entry", () => {
      lru.set("a", 1);
      expect(lru.delete("a")).toBe(true);
      expect(lru.has("a")).toBe(false);
      expect(lru.size).toBe(0);
    });

    it("should return false when deleting a non-existent key", () => {
      expect(lru.delete("a")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      lru.set("a", 1);
      lru.set("b", 2);
      lru.clear();
      expect(lru.size).toBe(0);
      expect(lru.has("a")).toBe(false);
    });
  });

  describe("size", () => {
    it("should reflect the current number of entries", () => {
      expect(lru.size).toBe(0);
      lru.set("a", 1);
      expect(lru.size).toBe(1);
      lru.set("b", 2);
      expect(lru.size).toBe(2);
    });

    it("should not exceed maxSize", () => {
      lru.set("a", 1);
      lru.set("b", 2);
      lru.set("c", 3);
      lru.set("d", 4);
      lru.set("e", 5);
      expect(lru.size).toBe(3);
    });
  });
});
