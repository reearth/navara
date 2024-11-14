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
