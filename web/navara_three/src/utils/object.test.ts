import { expect, it } from "vitest";

import { getExcludedKeys } from "./object";

it("should get all excluded keys", () => {
  const obj = { type: "layer", material1: {}, material2: {} };
  expect(getExcludedKeys(obj, ["type"])).toEqual(["material1", "material2"]);

  expect(getExcludedKeys(obj, ["type", "material1"])).toEqual(["material2"]);

  expect(getExcludedKeys(obj, ["type", "material1", "material2"])).toEqual([]);

  expect(getExcludedKeys(obj, [])).toEqual(["type", "material1", "material2"]);
});
