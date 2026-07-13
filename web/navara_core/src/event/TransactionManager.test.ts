import { expect, it, vi } from "vitest";

import { TransactionManager } from "./TransactionManager";

it("should manage transaction", async () => {
  const transactionManager = new TransactionManager();
  const transaction = transactionManager.getOrInsert("test");

  const mockFn = vi.fn();
  const mockFnDuplicated = vi.fn();
  const mockFnNext = vi.fn();

  // First frame
  transaction
    .then(async () => mockFn())
    .then(async () => mockFnNext())
    .end();

  // Second frame
  transaction.then(async () => mockFnDuplicated());
  transaction.then(async () => mockFnDuplicated());

  await vi.waitUntil(() => !transaction.continuable);
  expect(mockFn).toBeCalledTimes(1);
  expect(mockFnNext).toBeCalledTimes(0);

  // Third frame
  transaction
    .then(async () => mockFn())
    .then(async () => mockFnNext())
    .end();
  transaction
    .then(async () => mockFnDuplicated())
    .then(async () => mockFnDuplicated());

  await vi.waitUntil(() => !transaction.next?.continuable);
  expect(mockFn).toBeCalledTimes(1);
  expect(mockFnNext).toBeCalledTimes(1);

  expect(transaction.next?.next?.continuable).toBeTruthy();

  // Forth frame
  transaction
    .then(async () => mockFn())
    .then(async () => mockFnNext())
    .end();

  expect(mockFn).toBeCalledTimes(1);
  expect(mockFnNext).toBeCalledTimes(1);
  expect(mockFnDuplicated).not.toBeCalled();

  expect(transaction.continuable).toBeTruthy();
  expect(transaction.next?.continuable).toBeFalsy();
  expect(transaction.next?.next?.continuable).toBeFalsy();
});

it("should continue the transaction chain after a rejected callback", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const transactionManager = new TransactionManager();
  const transaction = transactionManager.getOrInsert("test");

  const mockFnNext = vi.fn();
  const mockFnRecovered = vi.fn();

  // First frame: the first-phase callback fails. Before the fix this left
  // `currentPending` set forever, wedging the whole transaction id.
  transaction
    .then(async () => {
      throw new Error("boom");
    })
    .then(async () => mockFnNext())
    .end();

  // Later frames replay the same chain; both phases must eventually run.
  await vi.waitUntil(() => {
    transaction
      .then(async () => mockFnRecovered())
      .then(async () => mockFnNext())
      .end();
    return (
      mockFnRecovered.mock.calls.length > 0 && mockFnNext.mock.calls.length > 0
    );
  });

  expect(consoleError).toHaveBeenCalledWith(
    expect.stringContaining('Transaction "test" callback failed:'),
    expect.any(Error),
  );
  consoleError.mockRestore();
});

it("should continue the transaction chain after a synchronously throwing callback", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const transactionManager = new TransactionManager();
  const transaction = transactionManager.getOrInsert("test");

  const mockFnNext = vi.fn();
  const mockFnRecovered = vi.fn();

  // First frame: the callback throws before ever returning a promise. This
  // must be contained just like a rejection, or the continuable flags stay
  // down forever.
  transaction
    .then(() => {
      throw new Error("boom");
    })
    .then(async () => mockFnNext())
    .end();

  // Later frames replay the same chain; both phases must eventually run.
  await vi.waitUntil(() => {
    transaction
      .then(async () => mockFnRecovered())
      .then(async () => mockFnNext())
      .end();
    return (
      mockFnRecovered.mock.calls.length > 0 && mockFnNext.mock.calls.length > 0
    );
  });

  expect(consoleError).toHaveBeenCalledWith(
    expect.stringContaining('Transaction "test" callback failed:'),
    expect.any(Error),
  );
  consoleError.mockRestore();
});
