import { type Events } from "navara";

import { generate_id_from_entity, isEntityEvent } from "../id";

import { TransactionManager } from "./TransactionManager";

export type JsEvents = Omit<Events, "free">;
export type JsEventsKey = keyof JsEvents;

type EventsStacks = {
  [K in JsEventsKey]-?: JsEvents[K] extends unknown[]
    ? JsEvents[K]
    : JsEvents[K][];
};

type GetJsEventValue<K extends JsEventsKey> = EventsStacks[K] extends unknown[]
  ? EventsStacks[K][number]
  : EventsStacks[K];

type TransactionProcessOption<
  AddKey extends JsEventsKey,
  RemoveKey extends JsEventsKey,
  ChangeKey extends JsEventsKey,
> = {
  add: {
    key: AddKey;
    max?: number;
  };
  remove: {
    key: RemoveKey;
    max?: number;
  };
  change: {
    key: ChangeKey;
    max?: number;
  };
};

type TransactionCallbackParams<
  AddKey extends JsEventsKey,
  RemoveKey extends JsEventsKey,
  ChangeKey extends JsEventsKey,
> =
  | { type: "add"; event: GetJsEventValue<AddKey> }
  | { type: "remove"; event: GetJsEventValue<RemoveKey> }
  | { type: "change"; event: GetJsEventValue<ChangeKey> };

export class EventManager {
  stacks: EventsStacks = {
    camera_transform_updated: [],
    data_requested: [],
    mesh_added: [],
    mesh_updated: [],
    object_removed: [],
    object_transform_updated: [],
    renderable_feature_added: [],
    renderable_feature_changed: [],
    renderable_feature_removed: [],
    texture_fragment_removed: [],
    texture_fragment_requested: [],
  };
  private transactionManager = new TransactionManager();

  pushEvents(events: Events) {
    for (const k of Object.keys(this.stacks) as JsEventsKey[]) {
      const event = events[k];
      if (!event) continue;
      if (Array.isArray(event)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this.stacks[k] = this.stacks[k].concat(event) as JsEvents[JsEventsKey];
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this.stacks[k].push(event);
      }
    }
  }

  forEachStack<Key extends JsEventsKey>(
    key: Key,
    cb: (value: GetJsEventValue<Key>) => void,
    max = 10,
  ) {
    let idx = 0;
    for (const value of this.stacks[key]) {
      if (idx === max) {
        break;
      }

      cb(value as GetJsEventValue<Key>);

      idx++;
    }

    // Remove processed events
    this.stacks[key].splice(0, idx);
  }

  async forEachStackAsync<Key extends JsEventsKey>(
    key: Key,
    cb: (value: GetJsEventValue<Key>) => Promise<void>,
    max = 20,
    shouldRemoveStack?: (value: GetJsEventValue<Key>) => boolean,
  ) {
    const promises = [];

    let idx = 0;
    const removedIndices = [];
    for (const value of this.stacks[key]) {
      if (idx === max) {
        break;
      }

      const v = value as GetJsEventValue<Key>;

      promises.push(cb(v));

      if (!shouldRemoveStack || (shouldRemoveStack && shouldRemoveStack(v))) {
        removedIndices.push(idx);
      }

      idx++;
    }

    let offset = 0;
    for (const idx of removedIndices) {
      // Remove processed events
      this.stacks[key].splice(idx - offset, 1);
      offset++;
    }

    await Promise.all(promises);
  }

  removeDuplicatedTransactionEvents<
    AddKey extends JsEventsKey,
    RemoveKey extends JsEventsKey,
    ChangeKey extends JsEventsKey,
  >(options: TransactionProcessOption<AddKey, RemoveKey, ChangeKey>) {
    let removedIdx = 0;
    const processedEvents = [];
    for (const removed of this.stacks[options.remove.key]) {
      if (!isEntityEvent(removed)) {
        removedIdx++;
        continue;
      }
      const removedId = generate_id_from_entity(removed);
      const removedAddedEventIdx = this.stacks[options.add.key].findIndex(
        (added) => {
          if (!isEntityEvent(added)) return;
          const addedId = generate_id_from_entity(added);
          return removedId === addedId;
        },
      );
      const removedChangedEventIdx = this.stacks[options.change.key].findIndex(
        (changed) => {
          if (!isEntityEvent(changed)) return;
          const changedId = generate_id_from_entity(changed);
          return removedId === changedId;
        },
      );

      const isRemovedAddedEventIdxFound = removedAddedEventIdx !== -1;
      if (isRemovedAddedEventIdxFound) {
        this.stacks[options.add.key].splice(removedAddedEventIdx, 1);
      }
      const isRemovedChangedEventIdx = removedChangedEventIdx !== -1;
      if (isRemovedChangedEventIdx) {
        this.stacks[options.change.key].splice(removedChangedEventIdx, 1);
      }
      if (isRemovedAddedEventIdxFound) {
        processedEvents.push(removedIdx);
      }
      removedIdx++;
    }

    let removedIdxOffset = 0;
    for (const idx of processedEvents) {
      this.stacks[options.remove.key].splice(idx - removedIdxOffset, 1);
      removedIdxOffset++;
    }
  }

  processTransactionEvents<
    AddKey extends JsEventsKey,
    RemoveKey extends JsEventsKey,
    ChangeKey extends JsEventsKey,
  >(
    transactionKey: string,
    options: TransactionProcessOption<AddKey, RemoveKey, ChangeKey>,
    cb: (
      ev: TransactionCallbackParams<AddKey, RemoveKey, ChangeKey>,
    ) => Promise<void>,
    shouldRemoveStack?: (
      ev: TransactionCallbackParams<AddKey, RemoveKey, ChangeKey>,
    ) => boolean,
  ) {
    this.removeDuplicatedTransactionEvents(options);

    this.transactionManager
      .getOrInsert(transactionKey)
      .then(() =>
        this.forEachStackAsync(
          options.add.key,
          (event) => cb({ type: "add", event }),
          options.add.max,
          shouldRemoveStack
            ? (event) => shouldRemoveStack({ type: "add", event })
            : undefined,
        ),
      )
      .then(() =>
        this.forEachStackAsync(
          options.remove.key,
          (event) => cb({ type: "remove", event }),
          options.remove.max,
          shouldRemoveStack
            ? (event) => shouldRemoveStack({ type: "remove", event })
            : undefined,
        ),
      )
      .then(() =>
        this.forEachStackAsync(
          options.change.key,
          (event) => cb({ type: "change", event }),
          options.change.max,
          shouldRemoveStack
            ? (event) => shouldRemoveStack({ type: "change", event })
            : undefined,
        ),
      )
      .end();
  }
}
