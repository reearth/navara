import { expect, it } from "vitest";

import { getFilteredKeys } from "./object";

it("should get all filtered keys", () => {
  const obj = { type: "layer", material1: {}, material2: {} };
  expect(getFilteredKeys(obj, ["type"])).toEqual(["material1", "material2"]);

  expect(getFilteredKeys(obj, ["type", "material1"])).toEqual(["material2"]);

  expect(getFilteredKeys(obj, ["type", "material1", "material2"])).toEqual([]);

  expect(getFilteredKeys(obj, [])).toEqual(["type", "material1", "material2"]);
});
