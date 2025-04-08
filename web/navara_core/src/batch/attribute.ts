import type { TypedArrayLike } from "../types";

export const setBatchedValuesToBatchedAttribute = (
  values: TypedArrayLike,
  batchIds: TypedArrayLike,
  attr: TypedArrayLike,
) => {
  const len = batchIds.length;
  for (let i = 0; i < len; i++) {
    const batchId = batchIds[i];
    const value = values[batchId];
    attr[i] = value;
  }
};
