// Ref: https://github.com/takram-design-engineering/geovanni/blob/ee91f675ba2558ee3099f635dfa30bbe3adfe103/libs/core/src/assertions.ts

export function assertType<T>(_value: unknown): asserts _value is T {}

export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value != null;
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isNotFalse<T>(value: T | false): value is T {
  return value !== false;
}
