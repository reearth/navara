import { type Events } from "@navara/engine";

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
  change?: {
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

const defaultGenerateEventId = <
  AddKey extends JsEventsKey,
  RemoveKey extends JsEventsKey,
  ChangeKey extends JsEventsKey,
>(
  ev: TransactionCallbackParams<AddKey, RemoveKey, ChangeKey>,
) => {
  const { event } = ev;

  if (!isEntityEvent(event)) {
    return;
  }
  const id = generate_id_from_entity(event);
  return id;
};

export class EventManager {
  stacks: EventsStacks = {
    camera_transform_updated: [],
    camera_frustum_updated: [],
    data_requested: [],
    data_requester_removed: [],
    mesh_added: [],
    mesh_updated: [],
    mesh_removed: [],
    object_transform_updated: [],
    renderable_feature_added: [],
    renderable_feature_changed: [],
    renderable_feature_removed: [],
    texture_fragment_removed: [],
    texture_fragment_requested: [],
    update_sample_terrain_height: [],
    worker_task_delegated: [],
    worker_task_removed: [],
  };
  addedEventIds = new Set();
  private transactionManager = new TransactionManager();

  needsUpdate() {
    return Object.values(this.stacks).some((v) => !!v.length);
  }

  pushEvents(events: Events | undefined) {
    for (const k of Object.keys(this.stacks) as JsEventsKey[]) {
      const event = events?.[k];
      if (!event) continue;
      if (Array.isArray(event)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        this.stacks[k].push(...event);
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

      if (value?.free && value.free instanceof Function) {
        value.free();
      }

      idx++;
    }

    // Remove processed events
    this.stacks[key].splice(0, idx);
  }

  async forEachStackAsync<Key extends JsEventsKey>(
    key: Key,
    cb: (value: GetJsEventValue<Key>) => Promise<void>,
    max = 20,
    shouldProcess?: (value: GetJsEventValue<Key>) => boolean,
  ) {
    const promises = [];

    let idx = 0;
    const removedIndices = [];
    for (const value of this.stacks[key]) {
      if (idx === max) {
        break;
      }

      const v = value as GetJsEventValue<Key>;

      if (shouldProcess && !shouldProcess(v)) {
        idx++;
        continue;
      }

      promises.push(cb(v));

      removedIndices.push(idx);

      idx++;
    }

    const removedEvs = [];

    let offset = 0;
    for (const idx of removedIndices) {
      // Remove processed events
      const i = idx - offset;
      removedEvs.push(this.stacks[key][i]);
      this.stacks[key].splice(i, 1);
      offset++;
    }

    await Promise.all(promises);

    for (const e of removedEvs) {
      if (e?.free && e.free instanceof Function) {
        e.free();
      }
    }
  }

  // Remove duplicated events before it's proceeded.
  // For example, if MeshAdd event and MeshRemove event are exist, it should be considered as duplicated.
  removeDuplicatedTransactionEvents<
    AddKey extends JsEventsKey,
    RemoveKey extends JsEventsKey,
    ChangeKey extends JsEventsKey,
  >(options: TransactionProcessOption<AddKey, RemoveKey, ChangeKey>) {
    const addedEventsMap = new Map<string, number>();
    const changedEventsMap = options.change ? new Map<string, number>() : null;

    this.stacks[options.add.key].forEach((added, index) => {
      if (isEntityEvent(added)) {
        const id = generate_id_from_entity(added);
        addedEventsMap.set(id, index);
      }
    });

    if (changedEventsMap && options.change) {
      this.stacks[options.change.key].forEach((changed, index) => {
        if (isEntityEvent(changed)) {
          const id = generate_id_from_entity(changed);
          changedEventsMap.set(id, index);
        }
      });
    }

    // Track indices to remove from each stack
    const addedIndicesToRemove = new Set<number>();
    const changedIndicesToRemove = new Set<number>();
    const removedIndicesToSkip = new Set<number>();

    this.stacks[options.remove.key].forEach((removed, removeIdx) => {
      if (!isEntityEvent(removed)) return;

      const removedId = generate_id_from_entity(removed);

      const addedIdx = addedEventsMap.get(removedId);
      let foundMatch = false;

      if (addedIdx !== undefined) {
        addedIndicesToRemove.add(addedIdx);
        foundMatch = true;
      }

      if (changedEventsMap && options.change) {
        const changedIdx = changedEventsMap.get(removedId);
        if (changedIdx !== undefined) {
          changedIndicesToRemove.add(changedIdx);
        }
      }

      if (foundMatch) {
        removedIndicesToSkip.add(removeIdx);
      }
    });

    if (addedIndicesToRemove.size > 0) {
      this.removeStacksByIndices(options.add.key, addedIndicesToRemove);
    }

    if (changedIndicesToRemove.size > 0 && options.change) {
      this.removeStacksByIndices(options.change.key, changedIndicesToRemove);
    }

    if (removedIndicesToSkip.size > 0) {
      this.removeStacksByIndices(options.remove.key, removedIndicesToSkip);
    }
  }

  removeStacksByIndices(key: JsEventsKey, removedIndices: Set<number>) {
    const sortedIndices = [...removedIndices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      this.stacks[key][idx]?.free();
      this.stacks[key].splice(idx, 1);
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
    handlers?: {
      shouldProcess?: (
        ev: TransactionCallbackParams<AddKey, RemoveKey, ChangeKey>,
      ) => boolean;
      generateEventId?: (
        ev: TransactionCallbackParams<AddKey, RemoveKey, ChangeKey>,
      ) => string;
      onAbort?: (ev: GetJsEventValue<RemoveKey>) => void;
    },
  ) {
    const {
      shouldProcess,
      generateEventId = defaultGenerateEventId,
      onAbort,
    } = handlers ?? {};

    this.removeDuplicatedTransactionEvents(options);

    const transaction = this.transactionManager
      .getOrInsert(transactionKey)
      .then(() =>
        this.forEachStackAsync(
          options.add.key,
          (event) => {
            if (onAbort) {
              this.addedEventIds.add(generateEventId({ type: "add", event }));
            }
            return cb({ type: "add", event });
          },
          options.add.max,
          shouldProcess
            ? (event) => shouldProcess({ type: "add", event })
            : undefined,
        ),
      )
      .then(() => {
        if (onAbort) {
          this.addedEventIds.clear();
        }
        return this.forEachStackAsync(
          options.remove.key,
          (event) => cb({ type: "remove", event }),
          options.remove.max,
          shouldProcess
            ? (event) => shouldProcess({ type: "remove", event })
            : undefined,
        );
      });

    // Handle an abort process to an add event.
    if (onAbort && this.addedEventIds.size) {
      for (const event of this.stacks[options.remove.key]) {
        if (!event) continue;
        const removeEv = event as GetJsEventValue<RemoveKey>;
        const id = generateEventId({ type: "remove", event: removeEv });
        if (id && this.addedEventIds.has(id)) {
          onAbort(removeEv);
          this.addedEventIds.delete(id);
        }
      }
    }

    if (options.change) {
      const change = options.change;
      transaction
        .then(() =>
          this.forEachStackAsync(
            change.key,
            (event) => cb({ type: "change", event }),
            change.max,
            shouldProcess
              ? (event) => shouldProcess({ type: "change", event })
              : undefined,
          ),
        )
        .end();
    } else {
      transaction.end();
    }
  }
}
