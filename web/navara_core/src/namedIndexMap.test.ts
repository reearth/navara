import { describe, it, expect, beforeEach } from "vitest";

import { NamedIndexMap } from "./namedIndexMap";

type TestItem = {
  name: string;
  value: number;
};

describe("NamedIndexMap", () => {
  let map: NamedIndexMap<TestItem>;

  beforeEach(() => {
    map = new NamedIndexMap<TestItem>();
  });

  describe("add", () => {
    it("should add items to the list and indexMap", () => {
      const item1 = { name: "first", value: 1 };
      const item2 = { name: "second", value: 2 };

      map.add(item1);
      map.add(item2);

      expect(map.list).toEqual([item1, item2]);
      expect(map.indexMap).toEqual({ first: 0, second: 1 });
    });

    it("should throw error for duplicate names", () => {
      const item1 = { name: "duplicate", value: 1 };
      const item2 = { name: "duplicate", value: 2 };

      map.add(item1);
      expect(() => map.add(item2)).toThrow("duplicate name: duplicate");
    });
  });

  describe("insertBefore", () => {
    beforeEach(() => {
      map.add({ name: "first", value: 1 });
      map.add({ name: "second", value: 2 });
      map.add({ name: "third", value: 3 });
    });

    it("should insert item before target", () => {
      const newItem = { name: "new", value: 10 };
      map.insertBefore("second", newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "first",
        "new",
        "second",
        "third",
      ]);
      expect(map.indexMap).toEqual({ first: 0, new: 1, second: 2, third: 3 });
    });

    it("should insert before first item", () => {
      const newItem = { name: "new", value: 10 };
      map.insertBefore("first", newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "new",
        "first",
        "second",
        "third",
      ]);
      expect(map.indexMap).toEqual({ new: 0, first: 1, second: 2, third: 3 });
    });

    it("should throw error for non-existent target", () => {
      const newItem = { name: "new", value: 10 };
      expect(() => map.insertBefore("nonexistent", newItem)).toThrow(
        "target not found: nonexistent",
      );
    });

    it("should throw error for duplicate name", () => {
      const newItem = { name: "first", value: 10 };
      expect(() => map.insertBefore("second", newItem)).toThrow(
        "duplicate name: first",
      );
    });
  });

  describe("insertAfter", () => {
    beforeEach(() => {
      map.add({ name: "first", value: 1 });
      map.add({ name: "second", value: 2 });
      map.add({ name: "third", value: 3 });
    });

    it("should insert item after target", () => {
      const newItem = { name: "new", value: 10 };
      map.insertAfter("second", newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "first",
        "second",
        "new",
        "third",
      ]);
      expect(map.indexMap).toEqual({ first: 0, second: 1, new: 2, third: 3 });
    });

    it("should insert after last item", () => {
      const newItem = { name: "new", value: 10 };
      map.insertAfter("third", newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "first",
        "second",
        "third",
        "new",
      ]);
      expect(map.indexMap).toEqual({ first: 0, second: 1, third: 2, new: 3 });
    });

    it("should throw error for non-existent target", () => {
      const newItem = { name: "new", value: 10 };
      expect(() => map.insertAfter("nonexistent", newItem)).toThrow(
        "target not found: nonexistent",
      );
    });

    it("should throw error for duplicate name", () => {
      const newItem = { name: "second", value: 10 };
      expect(() => map.insertAfter("first", newItem)).toThrow(
        "duplicate name: second",
      );
    });
  });

  describe("insertAt", () => {
    beforeEach(() => {
      map.add({ name: "first", value: 1 });
      map.add({ name: "second", value: 2 });
      map.add({ name: "third", value: 3 });
    });

    it("should insert at beginning", () => {
      const newItem = { name: "new", value: 10 };
      (map as any).insertAt(0, newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "new",
        "first",
        "second",
        "third",
      ]);
      expect(map.indexMap).toEqual({ new: 0, first: 1, second: 2, third: 3 });
    });

    it("should insert at middle", () => {
      const newItem = { name: "new", value: 10 };
      (map as any).insertAt(2, newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "first",
        "second",
        "new",
        "third",
      ]);
      expect(map.indexMap).toEqual({ first: 0, second: 1, new: 2, third: 3 });
    });

    it("should insert at end", () => {
      const newItem = { name: "new", value: 10 };
      (map as any).insertAt(3, newItem);

      expect(map.list.map((item) => item.name)).toEqual([
        "first",
        "second",
        "third",
        "new",
      ]);
      expect(map.indexMap).toEqual({ first: 0, second: 1, third: 2, new: 3 });
    });

    it("should throw error for negative index", () => {
      const newItem = { name: "new", value: 10 };
      expect(() => (map as any).insertAt(-1, newItem)).toThrow(
        "index out of range: -1",
      );
    });

    it("should throw error for index greater than length", () => {
      const newItem = { name: "new", value: 10 };
      expect(() => (map as any).insertAt(4, newItem)).toThrow(
        "index out of range: 4",
      );
    });

    it("should throw error for duplicate name", () => {
      const newItem = { name: "first", value: 10 };
      expect(() => (map as any).insertAt(1, newItem)).toThrow(
        "duplicate name: first",
      );
    });
  });

  describe("findIndex", () => {
    beforeEach(() => {
      map.add({ name: "first", value: 1 });
      map.add({ name: "second", value: 2 });
    });

    it("should return correct index for existing name", () => {
      expect((map as any).findIndex("first")).toBe(0);
      expect((map as any).findIndex("second")).toBe(1);
    });

    it("should throw error for non-existent name", () => {
      expect(() => (map as any).findIndex("nonexistent")).toThrow(
        "target not found: nonexistent",
      );
    });
  });

  describe("assertUnique", () => {
    beforeEach(() => {
      map.add({ name: "existing", value: 1 });
    });

    it("should not throw for unique name", () => {
      expect(() => (map as any).assertUnique("unique")).not.toThrow();
    });

    it("should throw for duplicate name", () => {
      expect(() => (map as any).assertUnique("existing")).toThrow(
        "duplicate name: existing",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty map", () => {
      expect(map.list).toEqual([]);
      expect(map.indexMap).toEqual({});
    });

    it("should handle single item", () => {
      const item = { name: "single", value: 1 };
      map.add(item);

      expect(map.list).toEqual([item]);
      expect(map.indexMap).toEqual({ single: 0 });
    });

    it("should maintain correct indices after multiple insertions", () => {
      map.add({ name: "a", value: 1 });
      map.add({ name: "b", value: 2 });
      map.add({ name: "c", value: 3 });

      map.insertBefore("b", { name: "x", value: 10 });
      map.insertAfter("c", { name: "y", value: 20 });

      expect(map.list.map((item) => item.name)).toEqual([
        "a",
        "x",
        "b",
        "c",
        "y",
      ]);
      expect(map.indexMap).toEqual({ a: 0, x: 1, b: 2, c: 3, y: 4 });
    });
  });
});
