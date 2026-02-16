import { beforeEach, expect, it, vi } from "vitest";
import workerpool from "workerpool";
import type Pool from "workerpool/types/Pool";

import { createConcurrencyManager } from "./manager";
import { initializeWorkerPool, queueTask } from "./pool";

const workPoolExecStates = (() => {
  const states = {
    resolve: false,
    reject: false,
    rejectBeforePromise: false,
  };
  const reset = () => {
    states.rejectBeforePromise = false;
    states.resolve = false;
    states.reject = false;
  };

  return { states, reset };
})();

vi.spyOn(workerpool, "pool").mockImplementation(
  () =>
    ({
      exec: (_method: string, _params?: unknown, _options?: unknown) => {
        if (workPoolExecStates.states.rejectBeforePromise) {
          throw new Error();
        }
        return new workerpool.Promise(
          (resolve: () => void, reject: () => void) => {
            if (workPoolExecStates.states.resolve) {
              resolve();
            }
            if (workPoolExecStates.states.reject) {
              reject();
            }
          },
        );
      },
    }) as Pool,
);

// Worker pool is initialized globally.
const manager = createConcurrencyManager(1);
const incrementFnMock = vi.spyOn(manager, "increment");
initializeWorkerPool("https://example.com", manager);

beforeEach(() => {
  workPoolExecStates.reset();
  incrementFnMock.mockClear();
});

it("should increment and decrement concurrency when the promise is resolved", async () => {
  workPoolExecStates.states.resolve = true;

  const promise = queueTask("test" as any);
  await promise;
  expect(incrementFnMock).toHaveBeenCalledOnce();
  expect(manager.actives()).toBe(0);
});

it("should increment and decrement concurrency when the promise is rejected", async () => {
  workPoolExecStates.states.reject = true;

  const promise = queueTask("test" as any);
  try {
    await promise;
    expect.fail("Expect that this case throws an error");
  } catch {
    expect(incrementFnMock).toHaveBeenCalledOnce();
    expect(manager.actives()).toBe(0);
  }
});

it("should increment and decrement concurrency when the function throws an error before returning the promise", async () => {
  workPoolExecStates.states.rejectBeforePromise = true;

  try {
    queueTask("test" as any);
    expect.fail("Expect that this case throws an error");
  } catch {
    expect(incrementFnMock).toHaveBeenCalledOnce();
    expect(manager.actives()).toBe(0);
  }
});
