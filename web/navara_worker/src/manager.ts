export type ConcurrencyManager = {
  /** Total concurrency */
  total: number;
  /** Increment the count according to the activated process */
  increment: () => void;
  /** Decrement the count according to the deactivated process */
  decrement: () => void;
  /** Reset the count */
  reset: () => void;
  /** The number of activated processes */
  actives: () => number;
  /** The number of idle processes */
  idles: () => number;
  /** Whether it can activate the process */
  canIncrement: () => boolean;
  /** Whether there is an activated process */
  canDecrement: () => boolean;
};
export const createConcurrencyManager = (total: number): ConcurrencyManager => {
  let actives = 0;

  const canIncrement = () => actives !== total;
  const canDecrement = () => actives !== 0;

  return {
    total,
    actives: () => actives,
    idles: () => total - actives,
    increment: () => {
      if (!canIncrement()) return;
      actives++;
    },
    decrement: () => {
      if (!canDecrement()) return;
      actives--;
    },
    canIncrement,
    canDecrement,
    reset: () => {
      actives = 0;
    },
  };
};
