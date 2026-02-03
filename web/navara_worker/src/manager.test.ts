import { expect, it } from "vitest";

import { createConcurrencyManager } from "./manager";

it("should get correct concurrency states", () => {
  const manager = createConcurrencyManager(1);

  // Initialize
  expect(manager.actives()).toBe(0);
  expect(manager.idles()).toBe(1);
  expect(manager.total).toBe(1);

  // Increment

  expect(manager.canIncrement()).toBeTruthy();

  manager.increment();
  expect(manager.actives()).toBe(1);
  expect(manager.idles()).toBe(0);

  expect(manager.canIncrement()).toBeFalsy();
  manager.increment();
  expect(manager.actives()).toBe(1);
  expect(manager.idles()).toBe(0);

  // Decrement

  expect(manager.canDecrement()).toBeTruthy();

  manager.decrement();
  expect(manager.actives()).toBe(0);
  expect(manager.idles()).toBe(1);

  expect(manager.canDecrement()).toBeFalsy();
  manager.decrement();
  expect(manager.actives()).toBe(0);
  expect(manager.idles()).toBe(1);

  // Reset

  manager.increment();
  manager.reset();
  expect(manager.actives()).toBe(0);
  expect(manager.idles()).toBe(1);
});
