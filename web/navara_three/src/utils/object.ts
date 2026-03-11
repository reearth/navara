export const getExcludedKeys = <O extends object, K extends keyof O>(
  object: O,
  filters: K[],
) => {
  const keys = Object.keys(object) as (keyof O)[];
  return keys.filter((k) => !filters.includes(k as K));
};
