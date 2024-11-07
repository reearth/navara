import { expect, it, vi } from "vitest";

import { wait } from "../time";

import { EventManager } from "./EventManager";
import { makeEvent, makeRenderableFeatures } from "./mock";

it("should handle renderable feature event", async () => {
  const eventManager = new EventManager();

  const mockFnAdded = vi.fn();
  const mockFnRemoved = vi.fn();
  const mockFnChanged = vi.fn();

  // First frame
  eventManager.pushEvents(
    makeEvent({
      renderable_feature_added: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 2),
        makeRenderableFeatures(1, 3),
        makeRenderableFeatures(1, 4),
      ],
      renderable_feature_removed: [],
      renderable_feature_changed: [],
    }),
  );

  eventManager.processTransactionEvents(
    "renderableFeature",
    {
      add: {
        key: "renderable_feature_added",
        max: 3,
      },
      remove: {
        key: "renderable_feature_removed",
      },
      change: {
        key: "renderable_feature_changed",
      },
    },
    async ({ type }) => {
      switch (type) {
        case "add":
          await wait(100);
          mockFnAdded();
          break;
        case "remove":
          await wait(100);
          mockFnRemoved();
          break;
        case "change":
          await wait(100);
          mockFnChanged();
          break;
      }
    },
  );

  await vi.waitFor(() => expect(mockFnAdded).toBeCalledTimes(3));
  expect(mockFnRemoved).not.toBeCalled();
  expect(mockFnChanged).not.toBeCalled();

  mockFnAdded.mockReset();

  // Second frame
  eventManager.pushEvents(
    makeEvent({
      renderable_feature_added: [],
      renderable_feature_removed: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 4),
      ],
      renderable_feature_changed: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 2),
        makeRenderableFeatures(1, 3),
      ],
    }),
  );

  eventManager.processTransactionEvents(
    "renderableFeature",
    {
      add: {
        key: "renderable_feature_added",
        max: 3,
      },
      remove: {
        key: "renderable_feature_removed",
      },
      change: {
        key: "renderable_feature_changed",
      },
    },
    async ({ type }) => {
      switch (type) {
        case "add":
          await wait(100);
          mockFnAdded();
          break;
        case "remove":
          await wait(100);
          mockFnRemoved();
          break;
        case "change":
          await wait(100);
          mockFnChanged();
          break;
      }
    },
  );

  expect(mockFnAdded).not.toBeCalled();
  await vi.waitFor(() => expect(mockFnRemoved).toBeCalledTimes(1));
  expect(mockFnChanged).not.toBeCalled();

  mockFnRemoved.mockReset();

  // Third frame
  eventManager.processTransactionEvents(
    "renderableFeature",
    {
      add: {
        key: "renderable_feature_added",
        max: 3,
      },
      remove: {
        key: "renderable_feature_removed",
      },
      change: {
        key: "renderable_feature_changed",
      },
    },
    async ({ type }) => {
      switch (type) {
        case "add":
          await wait(100);
          mockFnAdded();
          break;
        case "remove":
          await wait(100);
          mockFnRemoved();
          break;
        case "change":
          await wait(100);
          mockFnChanged();
          break;
      }
    },
  );

  expect(mockFnAdded).not.toBeCalled();
  expect(mockFnRemoved).not.toBeCalled();
  await vi.waitFor(() => expect(mockFnChanged).toBeCalledTimes(2));
});

it("should remove duplicated renderable feature event", async () => {
  const eventManager = new EventManager();

  eventManager.pushEvents(
    makeEvent({
      renderable_feature_added: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 2),
        makeRenderableFeatures(1, 3),
        makeRenderableFeatures(1, 4),
      ],
      renderable_feature_removed: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 3),
      ],
      renderable_feature_changed: [
        makeRenderableFeatures(1, 1),
        makeRenderableFeatures(1, 4),
      ],
    }),
  );

  eventManager.removeDuplicatedTransactionEvents({
    add: {
      key: "renderable_feature_added",
    },
    remove: {
      key: "renderable_feature_removed",
    },
    change: {
      key: "renderable_feature_changed",
    },
  });

  expect(eventManager.stacks.renderable_feature_added).toEqual([
    makeRenderableFeatures(1, 2),
    makeRenderableFeatures(1, 4),
  ]);
  expect(eventManager.stacks.renderable_feature_removed).toEqual([]);
  expect(eventManager.stacks.renderable_feature_changed).toEqual([
    makeRenderableFeatures(1, 4),
  ]);
});
