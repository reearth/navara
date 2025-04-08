import { expect, it } from "vitest";

import { setBatchedValuesToBatchedAttribute } from "./attribute";

it("should set values to attribute by batch id", () => {
  let batchIds = new Uint32Array([0, 1, 2, 3, 4]);
  let colors = new Float32Array([0, 1, 2, 3, 4]);
  const values = new Float32Array([5, 6, 7, 8, 9]);

  setBatchedValuesToBatchedAttribute(values, batchIds, colors);

  expect(colors).toEqual(values);

  batchIds = batchIds.reverse();
  colors = new Float32Array([0, 1, 2, 3, 4]);

  setBatchedValuesToBatchedAttribute(values, batchIds, colors);

  expect(colors).toEqual(values.reverse());
});
