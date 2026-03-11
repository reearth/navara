export const getFilteredKeys = <O extends object, K extends keyof O>(
  object: O,
  filters: K[],
) => {
  const keys = Object.keys(object) as K[];
  return keys.filter((k) => !filters.includes(k));
};
